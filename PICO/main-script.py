"""
Main script for reading NAU7802 ADC values on Raspberry Pi Pico W.
"""
from machine import Pin, I2C
import time
from nau7802driver import NAU7802, NAU7802_GAIN_128, NAU7802_RATE_10SPS, NAU7802_CALMOD_INTERNAL, NAU7802_RATE_320SPS

# Initialize I2C with the specified pins
sda = Pin(4)
scl = Pin(5)
i2c = I2C(0, sda=sda, scl=scl, freq=100000)

# Scan I2C bus for devices
print("Scanning I2C bus...")
devices = i2c.scan()
if devices:
    print(f"I2C devices found: {[hex(device) for device in devices]}")
else:
    print("No I2C devices found!")

# Create NAU7802 instance
adc = NAU7802(i2c)

# Initialize the ADC
print("Initializing NAU7802...")
if adc.begin():
    print("NAU7802 initialized successfully!")
    
    # Configure ADC settings
    print("Configuring ADC...")
    adc.setGain(NAU7802_GAIN_128)
    adc.setRate(NAU7802_RATE_320SPS)
    print(f"Gain set to: {adc.getGain()}")
    print(f"Sample rate set to: {adc.getRate()} SPS")
    
    # Perform calibration
    print("Calibrating...")
    if adc.calibrate(NAU7802_CALMOD_INTERNAL):
        print("Calibration successful!")
    else:
        print("Calibration failed!")
        
    print("Starting readings...")
    while True:
        if adc.available():
            reading = adc.read()
            print(f"ADC reading: {reading}")
        time.sleep_ms(1)  # Small delay between checking for new readings
else:
    print("Failed to initialize NAU7802!")
