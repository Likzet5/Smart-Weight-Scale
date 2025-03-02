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

# Calibration callback function
def calibrate_function(known_weight_kg):
    logger.info(f"Calibrating with weight: {known_weight_kg} kg")
    if sensor.calibrate(known_weight_kg):
        logger.info("Calibration successful")
        logger.blink(3, 200)  # Signal success with 3 blinks
    else:
        logger.error("Calibration failed")
        logger.error_blink(3)  # Signal failure

# Command callback function
def command_handler(opcode, value):
    # Handle specific commands if needed
    logger.info(f"Command handler received opcode: 0x{opcode:02x}")
    
    # Check for start measurement command (OPCODE_START_MEASUREMENT = 0x65)
    if opcode == 0x66:  # Using the direct value since we don't have access to the const
        logger.info("Resetting sensor readings due to start measurement command")
        sensor.reset_readings()

    pass

# Register callbacks
peripheral.on_tare(tare_function)
peripheral.on_command(command_handler)
peripheral.on_calibrate(calibrate_function)
#peripheral.on_start_measurement(lambda: sensor.reset_readings())

# Main loop variables
last_sample_time = time.ticks_ms()
last_led_time = time.ticks_ms()
# Add these lines after the other main loop variables
sample_counter = 0
last_hz_check = time.ticks_ms()
target_hz = config.SAMPLE_RATE_HZ

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
                
                # Count this sample
                sample_counter += 1
                
        # Check and log actual sampling rate once per second
        if time.ticks_diff(current_time, last_hz_check) >= 1000:
            if peripheral.is_measuring():
                logger.info(f"Actual sampling rate: {sample_counter} Hz (Target: {target_hz} Hz)")
            # Reset counter and timer
            sample_counter = 0
            last_hz_check = current_time
        
        # Prevent CPU hogging
        time.sleep_ms(1)
        
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        time.sleep_ms(1000)