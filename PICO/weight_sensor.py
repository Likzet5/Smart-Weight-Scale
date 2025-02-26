# weight_sensor.py - HX711 load cell sensor manager
import time
from machine import Pin
import config

class WeightSensor:
    """Manages HX711 load cell with simulation fallback"""
    
    def __init__(self, logger, dout_pin=None, sck_pin=None, scale_factor=None):
        """Initialize weight sensor or simulation"""
        self.logger = logger
        self.simulation_mode = False
        self.hx711 = None
        self.scale_factor = scale_factor or config.DEFAULT_SCALE_FACTOR
        
        # Try to initialize HX711
        try:
            self.logger.info("Initializing HX711 sensor")
            
            # Set up pins
            pin_OUT = Pin(dout_pin or config.PIN_HX711_DOUT, Pin.IN, pull=Pin.PULL_DOWN)
            pin_SCK = Pin(sck_pin or config.PIN_HX711_SCK, Pin.OUT)
            
            # Import HX711 module
            import hx711_pio
            
            # Create HX711 instance
            self.hx711 = hx711_pio.HX711(pin_SCK, pin_OUT, state_machine=0)
            
            # Test if working
            test_val = self.hx711.read()
            self.logger.info(f"HX711 test read: {test_val}")
            
            # Set scale factor
            self.hx711.set_scale(self.scale_factor)
            self.logger.info(f"Scale factor set to {self.scale_factor}")
            
            # Simulation mode is disabled since HX711 is working
            self.simulation_mode = False
            
        except ImportError:
            self.logger.warn("HX711 module not found, using simulation mode")
            self.simulation_mode = True
            
        except Exception as e:
            self.logger.error(f"HX711 initialization error: {e}")
            self.logger.error_blink(3)
            self.simulation_mode = True
    
    def tare(self, times=15):
        """Tare the scale (set current weight as zero)"""
        if self.simulation_mode:
            self.logger.info("Simulation mode: Fake tare")
            return True
            
        try:
            if self.hx711 is None:
                return False
                
            self.logger.info("Taring scale...")
            result = self.hx711.tare(times)
            self.logger.info("Tare complete")
            return result
            
        except Exception as e:
            self.logger.error(f"Tare error: {e}")
            # Try to recover
            try:
                if self.hx711:
                    self.hx711.reset_hx711()
            except:
                pass
            return False
    
    def calibrate(self, known_weight_kg):
        """Calibrate the scale using a known weight"""
        if self.simulation_mode:
            self.logger.info(f"Simulation mode: Can't calibrate")
            return False
            
        try:
            if self.hx711 is None:
                return False
                
            self.logger.info(f"Calibrating with known weight of {known_weight_kg} kg")
            
            # Take raw reading
            raw_value = self.hx711.get_value()
            
            # Calculate new scale factor 
            new_scale = raw_value / known_weight_kg
            
            # Set the new scale factor
            self.hx711.set_scale(new_scale)
            self.scale_factor = new_scale
            
            self.logger.info(f"Calibration complete. New scale factor: {new_scale}")
            return True
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
            # Get real weight from HX711
            try:
                if self.hx711 is None:
                    return 0
                    
                return max(0, self.hx711.get_units())  # Ensure non-negative
                
            except Exception as e:
                self.logger.error(f"Error reading weight: {e}")
                return 0
    
    def get_raw_reading(self):
        """Get raw (unscaled) reading for debugging"""
        if self.simulation_mode or self.hx711 is None:
            return 0
            
        try:
            return self.hx711.read_average(3)
        except Exception as e:
            self.logger.error(f"Error reading raw value: {e}")
            return 0