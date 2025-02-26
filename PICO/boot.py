# main.py - Main application for Strength Monitor
from machine import Pin, Timer
import bluetooth
import time
import sys

# Import our modules
import config
from logger import Logger
from strength_peripheral import StrengthPeripheral
from weight_sensor import WeightSensor

# Create logger instance
logger = Logger()
logger.info("Starting Strength Monitor...")

# Initialize BLE
try:
    ble = bluetooth.BLE()
    logger.info("BLE initialized")
except Exception as e:
    logger.error(f"BLE initialization failed: {e}")
    logger.error_blink(10, 50)
    sys.exit(1)  # Can't continue without BLE

# Initialize weight sensor
sensor = WeightSensor(logger)

# Create BLE peripheral
try:
    peripheral = StrengthPeripheral(ble, logger)
    logger.info("Peripheral created successfully")
except Exception as e:
    logger.error(f"Error creating peripheral: {e}")
    logger.error_blink(8, 100)
    sys.exit(1)

# Tare callback function
def tare_function():
    logger.blink(2, 200)  # Visual indicator
    sensor.tare()

# Command callback function
def command_handler(opcode, value):
    # Handle specific commands if needed
    pass

# Register callbacks
peripheral.on_tare(tare_function)
peripheral.on_command(command_handler)

# Main loop variables
last_sample_time = time.ticks_ms()
last_led_time = time.ticks_ms()

# Initial tare
sensor.tare()

logger.info("Waiting for connection...")

# Main loop
while True:
    try:
        current_time = time.ticks_ms()
        
        # Heartbeat LED when not connected (blink every second)
        if not peripheral.is_connected():
            if time.ticks_diff(current_time, last_led_time) >= 1000:
                logger.led.toggle()
                last_led_time = current_time
        
        # Only send data when connected and measuring
        if peripheral.is_connected() and peripheral.is_measuring():
            if time.ticks_diff(current_time, last_sample_time) >= config.SAMPLE_INTERVAL_MS:
                # Get weight and send
                weight = sensor.get_weight()
                peripheral.send_weight_measurement(weight)
                
                # Activity LED
                logger.led.toggle()
                
                # Update time
                last_sample_time = current_time
                last_led_time = current_time
        
        # Prevent CPU hogging
        time.sleep_ms(1)
        
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        time.sleep_ms(1000)
