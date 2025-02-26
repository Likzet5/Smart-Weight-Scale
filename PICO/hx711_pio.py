# hx711_pio.py - Modified version of the HX711 PIO driver with improved error handling
# Based on original MIT License code

from machine import Pin, Timer
import time
import rp2

class HX711:
    def __init__(self, clock, data, gain=128, state_machine=0):
        self.clock = clock
        self.data = data
        self.clock.value(False)

        self.GAIN = 0
        self.OFFSET = 0
        self.SCALE = 1

        self.time_constant = 0.25
        self.filtered = 0
        self.sm_timer = Timer()
        self.last_read_success = False
        self.error_count = 0
        self.max_errors = 10  # Maximum number of consecutive errors before giving up

        # create the state machine
        self.sm = rp2.StateMachine(state_machine, self.hx711_pio, freq=1_000_000,
                                   sideset_base=self.clock, in_base=self.data,
                                   jmp_pin=self.data)

        # determine the number of attempts to find the trigger pulse
        start = time.ticks_us()
        for _ in range(3):
            temp = self.data()
        spent = time.ticks_diff(time.ticks_us(), start)
        self.__wait_loop = 3_000_000 // spent

        self.set_gain(gain);
        
        # Try to read once to verify the sensor is working
        try:
            self.read()
            self.last_read_success = True
            print("HX711 initialized successfully")
        except Exception as e:
            print(f"Warning: Could not initialize HX711: {e}")
            self.last_read_success = False


    @rp2.asm_pio(
        sideset_init=rp2.PIO.OUT_LOW,
        in_shiftdir=rp2.PIO.SHIFT_LEFT,
        autopull=False,
        autopush=False,
    )
    def hx711_pio():
        pull()              .side (0)   # get the number of clock cycles
        mov(x, osr)         .side (0)

        label("bitloop")
        nop()               .side (1)   # active edge
        nop()               .side (1)
        in_(pins, 1)        .side (0)   # get the pin and shift it in
        jmp(x_dec, "bitloop")  .side (0)   # test for more bits
        
        label("finish")
        push(block)         .side (0)   # no, deliver data and start over

    def __del__(self):
        # Clean up timer if it exists
        if hasattr(self, 'sm_timer'):
            self.sm_timer.deinit()

    def set_gain(self, gain):
        if gain == 128:  # Fixed: changed 'is' to '=='
            self.GAIN = 1
        elif gain == 64:  # Fixed: changed 'is' to '=='
            self.GAIN = 3
        elif gain == 32:  # Fixed: changed 'is' to '=='
            self.GAIN = 2

        try:
            self.read()
            self.filtered = self.read()
            self.last_read_success = True
        except Exception as e:
            print(f"Warning: Could not set gain: {e}")
            self.last_read_success = False

    def conversion_done_cb(self, data):
        self.conversion_done = True
        data.irq(handler=None)

    def reset_hx711(self):
        """Try to reset the HX711 chip"""
        print("Attempting to reset HX711...")
        # Toggle clock line for >60 cycles with data high to reset
        self.data.init(Pin.OUT)
        self.data.value(True)
        
        # Pulse clock line for at least 60 cycles
        for _ in range(80):
            self.clock.value(True)
            time.sleep_us(10)
            self.clock.value(False)
            time.sleep_us(10)
            
        # Return data pin to input mode
        self.data.init(Pin.IN, Pin.PULL_DOWN)
        time.sleep_ms(10)  # Wait for chip to stabilize
        
        # Check if device is now responding
        for _ in range(500):
            if self.data.value() == False:
                print("HX711 reset successful")
                return True
            time.sleep_us(10)
        
        print("HX711 reset failed")
        return False

    def read(self):
        """Read a raw value from the HX711 with improved error handling"""
        # Check if we've had too many consecutive errors
        if self.error_count >= self.max_errors:
            if self.reset_hx711():
                self.error_count = 0
            else:
                raise OSError("HX711 not responding after multiple retries and reset")

        try:
            if hasattr(self.data, "irq"):
                self.conversion_done = False
                self.data.irq(trigger=Pin.IRQ_FALLING, handler=self.conversion_done_cb)
                # wait for the device being ready
                for _ in range(500):
                    if self.conversion_done == True:
                        break
                    time.sleep_ms(1)
                else:
                    self.data.irq(handler=None)
                    self.error_count += 1
                    raise OSError("Sensor does not respond to IRQ")
            else:
                # wait polling for the trigger pulse
                for _ in range(self.__wait_loop):
                    if self.data():
                        break
                else:
                    self.error_count += 1
                    raise OSError("No trigger pulse found")
                for _ in range(5000):
                    if not self.data():
                        break
                    time.sleep_us(100)
                else:
                    self.error_count += 1
                    raise OSError("Sensor does not respond to polling")

            # Feed the waiting state machine & get the data
            self.sm.active(1)  # start the state machine
            self.sm.put(self.GAIN + 24 - 1)     # set pulse count 25-27, start
            result = self.sm.get() >> self.GAIN # get the result & discard GAIN bits
            self.sm.active(0)  # stop the state machine
            
            if result == 0x7fffffff:
                self.error_count += 1
                raise OSError("Invalid data received from sensor")

            # check sign
            if result > 0x7fffff:
                result -= 0x1000000
                
            # Reset error count on successful read
            self.error_count = 0
            self.last_read_success = True
            return result
            
        except Exception as e:
            self.sm.active(0)  # Make sure to stop the state machine
            self.error_count += 1
            self.last_read_success = False
            raise

    def read_average(self, times=3):
        """Read multiple samples and return average, with retry logic"""
        sum = 0
        successful_reads = 0
        max_attempts = times * 2  # Try up to twice as many times as requested
        
        for _ in range(max_attempts):
            if successful_reads >= times:
                break
                
            try:
                sum += self.read()
                successful_reads += 1
            except Exception as e:
                print(f"Warning: Error during read_average: {e}")
                time.sleep_ms(50)  # Brief pause before retry
                
        if successful_reads == 0:
            raise OSError("Failed to get any valid readings")
            
        return sum / successful_reads

    def read_lowpass(self):
        """Read with low-pass filtering and error handling"""
        try:
            value = self.read()
            self.filtered += self.time_constant * (value - self.filtered)
            return self.filtered
        except Exception as e:
            print(f"Warning: Error during read_lowpass: {e}")
            return self.filtered  # Return last good value

    def get_value(self):
        """Get offset-compensated value with error handling"""
        try:
            return self.read_lowpass() - self.OFFSET
        except Exception as e:
            print(f"Warning: Error in get_value: {e}")
            if self.last_read_success:
                return self.filtered - self.OFFSET
            raise

    def get_units(self):
        """Get scaled units with error handling"""
        try:
            return self.get_value() / self.SCALE
        except Exception as e:
            print(f"Warning: Error in get_units: {e}")
            return 0  # Return zero on error

    def tare(self, times=15):
        """Tare the scale (set current weight as zero) with error handling"""
        print("Taring scale...")
        try:
            self.set_offset(self.read_average(times))
            print("Tare complete")
            return True
        except Exception as e:
            print(f"Error during tare: {e}")
            if self.reset_hx711():
                print("Retrying tare after reset...")
                try:
                    self.set_offset(self.read_average(times))
                    print("Tare complete after reset")
                    return True
                except:
                    print("Tare failed even after reset")
            return False

    def set_scale(self, scale):
        self.SCALE = scale

    def set_offset(self, offset):
        self.OFFSET = offset

    def set_time_constant(self, time_constant = None):
        if time_constant is None:
            return self.time_constant
        elif 0 < time_constant < 1.0:
            self.time_constant = time_constant

    def power_down(self):
        self.clock.value(False)
        self.clock.value(True)

    def power_up(self):
        self.clock.value(False)
