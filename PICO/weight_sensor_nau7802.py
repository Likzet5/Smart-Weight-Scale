# weight_sensor_nau7802.py - NAU7802 load cell sensor manager
import time
from machine import Pin, I2C
import config

class WeightSensor:
    """Manages NAU7802 load cell with simulation fallback"""
    
    def __init__(self, logger, sda_pin=None, scl_pin=None, scale_factor=None):
        """Initialize weight sensor or simulation"""
        self.logger = logger
        self.simulation_mode = False
        self.nau7802 = None
        self.scale_factor = scale_factor or config.DEFAULT_SCALE_FACTOR
        self.offset = 0
        
        # Try to initialize NAU7802
        try:
            self.logger.info("Initializing NAU7802 sensor")
            
            # Set up I2C
            sda = Pin(sda_pin or config.PIN_NAU7802_SDA)
            scl = Pin(scl_pin or config.PIN_NAU7802_SCK)
            i2c = I2C(config.NAU7802_I2C_ID, sda=sda, scl=scl, freq=config.NAU7802_I2C_FREQ)
            
            # Check if device is present on I2C bus
            devices = i2c.scan()
            if 0x2A not in devices:
                self.logger.error(f"NAU7802 not found on I2C bus. Devices: {[hex(d) for d in devices]}")
                raise Exception("NAU7802 not detected on I2C bus")
                
            # Import NAU7802 module
            from nau7802driver import NAU7802
            
            # Create NAU7802 instance
            self.nau7802 = NAU7802(i2c)
            
            # Initialize the sensor
            if not self.nau7802.begin():
                raise Exception("NAU7802 initialization failed")
                
            # Set gain
            self.nau7802.setGain(config.NAU7802_GAIN)
            
            # Set sample rate
            self.nau7802.setRate(config.NAU7802_SAMPLE_RATE)
            
            # Calibrate internal components
            if not self.nau7802.calibrate(0):  # Internal calibration
                self.logger.warn("NAU7802 internal calibration failed")
            
            # Test if working by reading a value
            time.sleep_ms(200)  # Allow time for first reading
            test_val = self.nau7802.read()
            self.logger.info(f"NAU7802 test read: {test_val}")
            
            # Simulation mode is disabled since NAU7802 is working
            self.simulation_mode = False
            
        except ImportError as e:
            self.logger.warn(f"NAU7802 module not found, using simulation mode: {e}")
            self.simulation_mode = True
            
        except Exception as e:
            self.logger.error(f"NAU7802 initialization error: {e}")
            self.logger.error_blink(3)
            self.simulation_mode = True
    
    def tare(self, times=10):
        """Tare the scale (set current weight as zero)"""
        if self.simulation_mode:
            self.logger.info("Simulation mode: Fake tare")
            return True
            
        try:
            if self.nau7802 is None:
                return False
                
            self.logger.info("Taring scale...")
            
            # Take multiple readings and average them for tare offset
            total = 0
            valid_readings = 0
            
            for _ in range(times):
                # Wait for data to be ready with timeout
                for attempt in range(100):  # 100ms timeout
                    if self.nau7802.available():
                        break
                    time.sleep_ms(1)
                
                if self.nau7802.available():
                    reading = self.nau7802.read()
                    total += reading
                    valid_readings += 1
                    time.sleep_ms(10)  # Short delay between readings
                    
            if valid_readings == 0:
                self.logger.error("Tare failed: no valid readings")
                return False
                
            # Set offset to the average reading
            self.offset = total / valid_readings
            self.logger.info(f"Tare complete. Offset: {self.offset}")
            return True
            
        except Exception as e:
            self.logger.error(f"Tare error: {e}")
            return False
    
    def calibrate(self, known_weight_kg):
        """Calibrate the scale using a known weight"""
        if self.simulation_mode:
            self.logger.info(f"Simulation mode: Can't calibrate")
            return False
            
        try:
            if self.nau7802 is None:
                return False
                
            self.logger.info(f"Calibrating with known weight of {known_weight_kg} kg")
            
            # Take multiple readings and average
            total = 0
            valid_readings = 0
            
            for _ in range(10):  # Take 10 readings for calibration
                for attempt in range(100):  # 100ms timeout
                    if self.nau7802.available():
                        break
                    time.sleep_ms(1)
                    
                if self.nau7802.available():
                    raw = self.nau7802.read()
                    total += raw
                    valid_readings += 1
                    time.sleep_ms(50)  # Delay between readings
                
            if valid_readings == 0:
                self.logger.error("Calibration failed: no valid readings")
                return False
                
            # Calculate raw average (with offset subtracted)
            raw_average = (total / valid_readings) - self.offset
            
            # Prevent division by zero
            if known_weight_kg <= 0.001:
                self.logger.error("Calibration failed: weight too small")
                return False
                
            # Calculate new scale factor (raw value per kg)
            new_scale = raw_average / known_weight_kg
            
            # Only update if the scale factor seems reasonable
            if abs(new_scale) > 0.1:  # Prevent division by near-zero values
                self.scale_factor = new_scale
                self.logger.info(f"Calibration complete. New scale factor: {new_scale}")
                return True
            else:
                self.logger.error(f"Calibration produced unreasonable scale factor: {new_scale}")
                return False
                
        except Exception as e:
            self.logger.error(f"Calibration error: {e}")
            return False
    
    def get_weight(self):
        """Read weight from sensor or generate simulated data"""
        if self.simulation_mode:
            # Generate simulated weight data
            base = 10 + (time.time() % 10)  # Slowly changing base
            noise = (time.ticks_ms() % 100) / 500  # Small noise component
            return base + noise
        else:
            # Get real weight from NAU7802
            try:
                if self.nau7802 is None:
                    return 0
                    
                # Wait for data to be ready (with timeout)
                for attempt in range(20):
                    if self.nau7802.available():
                        break
                    time.sleep_ms(1)
                
                if not self.nau7802.available():
                    return 0
                    
                # Read value and apply calibration
                raw_reading = self.nau7802.read()
                weight = (raw_reading - self.offset) / self.scale_factor
                
                # Return weight (ensure non-negative for display purposes)
                return max(0, weight)
                
            except Exception as e:
                self.logger.error(f"Error reading weight: {e}")
                return 0
    
    def get_raw_reading(self):
        """Get raw (unscaled) reading for debugging"""
        if self.simulation_mode or self.nau7802 is None:
            return 0
            
        try:
            # Wait for data to be ready
            for attempt in range(100):
                if self.nau7802.available():
                    break
                time.sleep_ms(1)
                
            if self.nau7802.available():
                return self.nau7802.read()
            return 0
        except Exception as e:
            self.logger.error(f"Error reading raw value: {e}")
            return 0
        
    def reset_readings(self):
        """Reset any accumulated readings in the sensor"""
        if self.simulation_mode:
            return True
            
        try:
            if self.nau7802 is None:
                return False
                
            self.logger.info("Resetting NAU7802 readings")
            
            # Flush any pending readings
            while self.nau7802.available():
                self.nau7802.read()
                time.sleep_ms(1)
                
            return True
        except Exception as e:
            self.logger.error(f"Error resetting sensor: {e}")
            return False