# logger.py - Simple logging module for the Strength Monitor
from machine import Pin
import time
import config

class Logger:
    """Simple logging with LED indicator capability"""
    
    def __init__(self, led_pin="LED"):
        self.enabled = config.LOG_ENABLED
        self.led = Pin(led_pin, Pin.OUT)
        self.led.off()
    
    def log(self, message, level="INFO"):
        """Log a message with optional level"""
        if self.enabled:
            timestamp = time.localtime()
            time_str = "{:02d}:{:02d}:{:02d}".format(
                timestamp[3], timestamp[4], timestamp[5])
            print(f"[{time_str}] {level}: {message}")
    
    def info(self, message):
        """Log info level message"""
        self.log(message, "INFO")
    
    def warn(self, message):
        """Log warning level message"""
        self.log(message, "WARN")
    
    def error(self, message):
        """Log error level message"""
        self.log(message, "ERROR")
    
    def blink(self, times=1, delay_ms=100):
        """Blink the LED"""
        for _ in range(times):
            self.led.on()
            time.sleep_ms(delay_ms)
            self.led.off()
            time.sleep_ms(delay_ms)
    
    def error_blink(self, count=3, speed_ms=100):
        """Blink LED to indicate error status"""
        for _ in range(count):
            self.led.on()
            time.sleep_ms(speed_ms)
            self.led.off()
            time.sleep_ms(speed_ms * 2)
