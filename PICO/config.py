# config.py - Configuration for Strength Monitor

# Hardware configuration
PIN_HX711_DOUT = 12
PIN_HX711_SCK = 13
DEFAULT_SCALE_FACTOR = 1.554606 * 0.1

# BLE configuration
DEVICE_NAME = "PicoStrength"
SERVICE_UUID = "7e4e1701-1ea6-40c9-9dcc-13d34ffead57"
DATA_UUID = "7e4e1702-1ea6-40c9-9dcc-13d34ffead57"
CONTROL_UUID = "7e4e1703-1ea6-40c9-9dcc-13d34ffead57"

# Application settings
SAMPLE_RATE_HZ = 80
SAMPLE_INTERVAL_MS = 1000 // SAMPLE_RATE_HZ
LOG_ENABLED = True
