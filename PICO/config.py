# config.py - Configuration for Strength Monitor

# Hardware configuration
PIN_HX711_DOUT = 12
PIN_HX711_SCK = 13
DEFAULT_SCALE_FACTOR = 15218  # Based on calibration with 2.573 kg

# NAU7802 configuration
PIN_NAU7802_SDA = 4
PIN_NAU7802_SCK = 5
NAU7802_I2C_ID = 0
NAU7802_I2C_FREQ = 400000  # 400 kHz I2C frequency
NAU7802_GAIN = 7  # NAU7802_GAIN_128 from driver
NAU7802_SAMPLE_RATE = 7  # NAU7802_RATE_40SPS from driver (80 SPS might be NAU7802_RATE_80SPS = 3)
"""
NAU7802_RATE_10SPS = 0
NAU7802_RATE_20SPS = 1
NAU7802_RATE_40SPS = 2
NAU7802_RATE_80SPS = 3
NAU7802_RATE_320SPS = 7
"""

DEFAULT_SCALE_FACTOR = 17416.1  # This will need calibration for your specific load cell  17416.1  17423.52

# BLE configuration
DEVICE_NAME = "Weight"
SERVICE_UUID = "7e4e1701-1ea6-40c9-9dcc-13d34ffead57"
DATA_UUID = "7e4e1702-1ea6-40c9-9dcc-13d34ffead57"
CONTROL_UUID = "7e4e1703-1ea6-40c9-9dcc-13d34ffead57"

# Application settings
SAMPLE_RATE_HZ = 200
SAMPLE_INTERVAL_MS = 1000 // SAMPLE_RATE_HZ
LOG_ENABLED = True