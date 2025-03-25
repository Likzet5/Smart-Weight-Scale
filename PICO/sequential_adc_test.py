# adc_performance_test.py - Single-ADC performance testing with comprehensive output
import time
from machine import Pin, I2C
import gc
import math

# Configuration
SENSOR_TYPE = "nau7802"  # Change to "nau7802" for second test hx711
TEST_DURATION_SEC = 10
SAMPLE_COUNT = 1000
SHOW_HISTOGRAMS = True  # Set to True to display ASCII histograms

# HX711 pins
HX711_DOUT_PIN = 12
HX711_SCK_PIN = 13

# NAU7802 I2C Address
NAU_ADDR = 0x2A

# NAU7802 pins and constants
NAU_SDA_PIN = 4
NAU_SCL_PIN = 5

# NAU7802 Registers
NAU_REG_PU_CTRL = 0x00  # Power-up control
NAU_REG_CTRL1 = 0x01    # Control 1
NAU_REG_CTRL2 = 0x02    # Control 2
NAU_REG_ADCO_B2 = 0x12  # ADC result Byte 2
NAU_REG_ADCO_B1 = 0x13
NAU_REG_ADCO_B0 = 0x14
NAU_ADC = 0x15          # ADC Control
NAU_REG_PWR_CTRL = 0x1C # PGA Power Control
NAU_DEV_REV = 0x1F      # Device Revision

# Bits within registers
NAU_PU_CTRL_RR = 0x01      # Register reset
NAU_PU_CTRL_PUD = 0x02     # Power up digital
NAU_PU_CTRL_PUA = 0x04     # Power up analog
NAU_PU_CTRL_PUR = 0x08     # Power up ready (read only)
NAU_PU_CTRL_CR = 0x20      # Cycle ready (read only)
NAU_PU_CTRL_AVDDS = 0x80   # AVDD source select

NAU_CTRL1_CRP = 0x80       # Conversion ready polarity

NAU_CTRL2_CALMOD = 0x07    # Calibration mode mask (bits 0-2)
NAU_CTRL2_CALS = 0x08      # Calibration start
NAU_CTRL2_CAL_ERROR = 0x10 # Calibration error (read only)

# Gain settings
NAU_GAIN_128X = 0x07

# Conversion rate settings
NAU_SPS_10 = 0x00
NAU_SPS_20 = 0x20
NAU_SPS_40 = 0x40
NAU_SPS_80 = 0x60
NAU_SPS_320 = 0x80

# Calibration modes
NAU_CALMOD_INTERNAL = (0x00)
NAU_CALMOD_OFFSET = (0x02)
NAU_CALMOD_GAIN = (0x03)
NAU_CALMOD_EXT_ANALOG = (0x04)

# LDO voltage settings
NAU_LDO_3V0 = (0x10)
NAU_LDO_3V3 = (0x18)


# Calibration status 
NAU_CAL_SUCCESS = (0)
NAU_CAL_IN_PROGRESS = (1)
NAU_CAL_FAILURE = (2)

# Channels
NAU_CHANNEL_1 = (0)
NAU_CHANNEL_2 = (1)

def init_hx711():
    """Initialize HX711 ADC"""
    import hx711_pio
    
    print(f"Initializing HX711 (DOUT={HX711_DOUT_PIN}, SCK={HX711_SCK_PIN})...")
    pin_out = Pin(HX711_DOUT_PIN, Pin.IN, pull=Pin.PULL_DOWN)
    pin_sck = Pin(HX711_SCK_PIN, Pin.OUT)
    hx711 = hx711_pio.HX711(pin_sck, pin_out)
    
    # Warmup
    for _ in range(5):
        hx711.read()
        time.sleep_ms(10)
        
    return hx711

def write_register(i2c, reg, value):
    """Write a byte to the specified register"""
    i2c.writeto_mem(NAU_ADDR, reg, bytes([value]))
    time.sleep_ms(10)  # Give device time to process

def write_register_verified(i2c, reg, value, retries=3):
    """Write with verification and retry"""
    for attempt in range(retries):
        write_register(i2c, reg, value)
        read_value = i2c.readfrom_mem(NAU_ADDR, reg, 1)[0]
        if read_value == value:
            return True
        print(f"Retry {attempt+1}: Write to reg 0x{reg:02X} failed: wrote 0x{value:02X}, read 0x{read_value:02X}")
        time.sleep_ms(10)
    return False

def init_nau7802(rate=0x10):
    """Initialize NAU7802 with proper calibration sequence"""
    print(f"Initializing NAU7802 (SDA={NAU_SDA_PIN}, SCL={NAU_SCL_PIN})")
    i2c = I2C(0, scl=Pin(NAU_SCL_PIN), sda=Pin(NAU_SDA_PIN), freq=100000)
    
    # Reset registers
    print("Performing reset sequence Set RR bit to 1 to reset")
    i2c.writeto_mem(NAU_ADDR, NAU_REG_PU_CTRL, b'\x01')  # Set RR bit
    time.sleep_ms(10)  # Wait 100ms; 10ms minimum
    
    # Set RR bit to 1 to reset
    print("Set RR bit to 0 to reset")
    i2c.writeto_mem(NAU_ADDR, NAU_REG_PU_CTRL, b'\x00')  # Set RR bit
    time.sleep_ms(10)  # Wait 100ms; 10ms minimum

    # Power up digital
    i2c.writeto_mem(NAU_ADDR, NAU_REG_PU_CTRL, b'\x02')  # Set PUD bit
    print("Power up digital")
    time.sleep_ms(10)  # Wait 750ms; 400ms minimum

    # Power up analog
    i2c.writeto_mem(NAU_ADDR, NAU_REG_PU_CTRL, b'\x04')  # Set PUA bits
    print("Power up analog")
    time.sleep_ms(10)  # Wait 750ms minimum
    
    # Check ready status
    start_time = time.time()
    while i2c.readfrom_mem(NAU_ADDR, NAU_REG_PU_CTRL, 1)[0] & 0x08:
        if time.time() - start_time > 1.0:  # 1 second timeout
            print("Timeout waiting for power up ready")
            return False
        time.sleep_ms(10)  # 10ms delay

    #pu_ctrl = i2c.readfrom_mem(NAU_ADDR, NAU_REG_PU_CTRL, 1)[0]
    #print(f"Power ready status: 0x{pu_ctrl:02X}")
    
    attempts = 0
    while attempts < 20:
        ctrl2 = i2c.readfrom_mem(NAU_ADDR, NAU_REG_CTRL2, 1)[0]
        if (ctrl2 & 0x04) == 0:  # CAL bit cleared
            break
        time.sleep_ms(10)
        attempts += 1
    
    # Configure LDO to 3.3V and gain to 128
    i2c.writeto_mem(NAU_ADDR, NAU_REG_CTRL1, b'\x27')  # LDO=3V3 (100), GAIN=128 (111)

    # Configure PGA - THIS IS CRITICAL
    i2c.writeto_mem(NAU_ADDR, 0x1B, b'\x30')  # Enable PGA, normal mode, no bypassing

    # Add these two lines here:
    # Select channel 1 (CHS=0) and set sample rate
    i2c.writeto_mem(NAU_ADDR, NAU_REG_CTRL2, b'\x30')  # 0x30 = 80SPS, CH1, mode 0

    # Continue with original calibration sequence
    # Turn off chopper clock
    i2c.writeto_mem(NAU_ADDR, 0x15, b'\x30')
    
    # Enable decoupling capacitor
    i2c.writeto_mem(NAU_ADDR, NAU_REG_PWR_CTRL, b'\x80')
    
    # Perform calibration
    print("Calibrating analog front end...")
    
    # Internal calibration
    #i2c.writeto_mem(NAU_ADDR, NAU_REG_CTRL2, b'\x32')  # Keep rate setting, set mode 00
    time.sleep_ms(10)
    
    # Start calibration
    i2c.writeto_mem(NAU_ADDR, NAU_REG_CTRL2, b'\x36')  # Set CAL bit
    time.sleep_ms(100)
    # Wait for calibration to complete
    attempts = 0
    while attempts < 20:
        ctrl2 = i2c.readfrom_mem(NAU_ADDR, NAU_REG_CTRL2, 1)[0]
        if (ctrl2 & 0x04) == 0:  # CAL bit cleared
            break
        time.sleep_ms(10)
        attempts += 1
    
    # Check for calibration error
    ctrl2 = i2c.readfrom_mem(NAU_ADDR, NAU_REG_CTRL2, 1)[0]
    cal_error = (ctrl2 & 0x08) != 0
    print(f"Calibration {'failed' if cal_error else 'successful'}")
    
    # Start conversions
    i2c.writeto_mem(NAU_ADDR, NAU_REG_PU_CTRL, b'\x16')  # Set PUD, PUA, CS bits
    time.sleep_ms(100)
    
    # Verify configuration
    pu_ctrl = i2c.readfrom_mem(NAU_ADDR, NAU_REG_PU_CTRL, 1)[0]
    ctrl1 = i2c.readfrom_mem(NAU_ADDR, NAU_REG_CTRL1, 1)[0]
    ctrl2 = i2c.readfrom_mem(NAU_ADDR, NAU_REG_CTRL2, 1)[0]
    
    print(f"PU_CTRL: 0x{pu_ctrl:02X} (expected 0x16)")
    print(f"CTRL1: 0x{ctrl1:02X} (expected 0x27)")
    print(f"CTRL2: 0x{ctrl2:02X} (expected 0x30)")
    
    return i2c
    

def read_nau7802(i2c):
    """Read 24-bit value from NAU7802"""
    # Check if conversion is ready
    if not (i2c.readfrom_mem(NAU_ADDR, NAU_REG_PU_CTRL, 1)[0] & 0x20):
        return None
        
    # Read 3 bytes
    data = bytearray(3)
    data[0] = i2c.readfrom_mem(NAU_ADDR, NAU_REG_ADCO_B2, 1)[0]
    data[1] = i2c.readfrom_mem(NAU_ADDR, NAU_REG_ADCO_B1, 1)[0]
    data[2] = i2c.readfrom_mem(NAU_ADDR, NAU_REG_ADCO_B0, 1)[0]
    
    # Convert to signed value
    value = (data[0] << 16) | (data[1] << 8) | data[2]
    if value & 0x800000:
        value -= 0x1000000
        
    return value

def calculate_statistics(samples, sample_times):
    """Calculate comprehensive statistics for the samples"""
    if not samples:
        return {}
        
    # Sample count
    count = len(samples)
    
    # Basic statistics
    mean = sum(samples) / count
    min_val = min(samples)
    max_val = max(samples)
    range_val = max_val - min_val
    
    # Calculate variance and standard deviation
    sq_diff_sum = sum((x - mean) ** 2 for x in samples)
    variance = sq_diff_sum / count
    std_dev = math.sqrt(variance)
    
    # Noise ratio (coefficient of variation)
    noise_ratio = (std_dev / abs(mean)) * 100 if mean != 0 else float('inf')
    
    # Calculate effective number of bits
    enob = math.log2(range_val / std_dev) if std_dev > 0 else 0
    
    # Calculate signal-to-noise ratio in dB
    snr = 20 * math.log10(abs(mean) / std_dev) if std_dev > 0 else 0
    
    # Time statistics
    avg_sample_time = sum(sample_times) / count if sample_times else 0
    min_sample_time = min(sample_times) if sample_times else 0
    max_sample_time = max(sample_times) if sample_times else 0
    
    # Calculate time intervals between samples and sample frequency
    if count > 1 and 'timestamps' in globals() and len(timestamps) >= count:
        intervals = [timestamps[i] - timestamps[i-1] for i in range(1, count)]
        avg_interval = sum(intervals) / len(intervals)
        avg_frequency = 1000000 / avg_interval if avg_interval > 0 else 0
    else:
        avg_interval = 0
        avg_frequency = 0
    
    return {
        "count": count,
        "mean": mean,
        "min": min_val,
        "max": max_val,
        "range": range_val,
        "variance": variance,
        "std_dev": std_dev,
        "noise_ratio_percent": noise_ratio,
        "enob": enob,
        "snr_db": snr,
        "avg_sample_time_us": avg_sample_time,
        "min_sample_time_us": min_sample_time,
        "max_sample_time_us": max_sample_time,
        "avg_interval_us": avg_interval,
        "frequency_hz": avg_frequency
    }

def display_ascii_histogram(samples, bins=20):
    """Display an ASCII histogram of sample distribution"""
    if not samples:
        return
    
    # Calculate bin ranges
    min_val = min(samples)
    max_val = max(samples)
    if min_val == max_val:
        print(f"No histogram possible - all values are {min_val}")
        return
        
    bin_width = (max_val - min_val) / bins
    
    # Count values in each bin
    bin_counts = [0] * bins
    for sample in samples:
        bin_idx = min(bins - 1, int((sample - min_val) / bin_width))
        bin_counts[bin_idx] += 1
    
    # Find maximum count for scaling
    max_count = max(bin_counts)
    max_width = 50
    
    print("\nSample Distribution Histogram:")
    print("-" * 60)
    
    for i in range(bins):
        bin_min = min_val + i * bin_width
        bin_max = min_val + (i + 1) * bin_width
        bar_width = int((bin_counts[i] / max_count) * max_width) if max_count > 0 else 0
        
        print(f"{bin_min:10.2f} - {bin_max:10.2f} | {'#' * bar_width} ({bin_counts[i]})")
    
    print("-" * 60)

def test_hx711():
    """Run HX711 performance test"""
    global timestamps
    hx711 = init_hx711()
    
    samples = []
    sample_times = []
    timestamps = []
    last_time = 0
    
    print(f"Collecting up to {SAMPLE_COUNT} samples from HX711...")
    
    start_time = time.time()
    sample_count = 0
    last_progress = 0
    
    while sample_count < SAMPLE_COUNT and (time.time() - start_time) < TEST_DURATION_SEC:
        gc.collect()  # Prevent memory issues
        
        # Record sample time
        sample_start = time.ticks_us()
        
        # Get reading
        try:
            reading = hx711.read()
            if reading is not None:
                current_time = time.ticks_us()
                
                # Store data
                samples.append(reading)
                sample_times.append(time.ticks_diff(current_time, sample_start))
                timestamps.append(current_time)
                sample_count += 1
                
                # Show progress every 10%
                progress = int((sample_count / SAMPLE_COUNT) * 10)
                if progress > last_progress:
                    print(f"{progress*10}% complete ({sample_count} samples)")
                    last_progress = progress
        except Exception as e:
            print(f"Error reading HX711: {e}")
    
    # Calculate test duration
    total_time = time.time() - start_time
    
    # Calculate statistics
    stats = calculate_statistics(samples, sample_times)
    stats["total_time_sec"] = total_time
    stats["samples_per_second"] = sample_count / total_time
    
    # Display results
    print(f"\nHX711 test complete: {sample_count} samples in {total_time:.2f} seconds")
    
    display_detailed_results(stats, samples, sample_times)
    return stats

def test_nau7802():
    """Run NAU7802 performance test"""
    global timestamps
    i2c = init_nau7802()
    
    samples = []
    sample_times = []
    timestamps = []
    
    print(f"Collecting up to {SAMPLE_COUNT} samples from NAU7802...")
    
    start_time = time.time()
    sample_count = 0
    last_progress = 0
    
    while sample_count < SAMPLE_COUNT and (time.time() - start_time) < TEST_DURATION_SEC:
        gc.collect()  # Prevent memory issues
        
        # Record sample time
        sample_start = time.ticks_us()
        
        # Get reading (busy wait for data ready)
        reading = None
        while reading is None:
            reading = read_nau7802(i2c)
            
            # Check if test is taking too long
            if time.time() - start_time > TEST_DURATION_SEC:
                break
        
        if reading is not None:
            current_time = time.ticks_us()
            
            # Store data
            samples.append(reading)
            sample_times.append(time.ticks_diff(current_time, sample_start))
            timestamps.append(current_time)
            sample_count += 1
            
            # Show progress every 10%
            progress = int((sample_count / SAMPLE_COUNT) * 10)
            if progress > last_progress:
                print(f"{progress*10}% complete ({sample_count} samples)")
                last_progress = progress
    
    # Calculate test duration
    total_time = time.time() - start_time
    
    # Calculate statistics
    stats = calculate_statistics(samples, sample_times)
    stats["total_time_sec"] = total_time
    stats["samples_per_second"] = sample_count / total_time
    
    # Display results
    print(f"\nNAU7802 test complete: {sample_count} samples in {total_time:.2f} seconds")
    
    display_detailed_results(stats, samples, sample_times)
    return stats

def display_detailed_results(stats, samples, sample_times):
    """Display comprehensive test results"""
    print("\n===== SENSOR PERFORMANCE ANALYSIS =====")
    
    # Performance metrics
    print("\n-- PERFORMANCE METRICS --")
    print(f"Sample Count: {stats['count']}")
    print(f"Total Test Time: {stats['total_time_sec']:.2f} seconds")
    print(f"Effective Sample Rate: {stats['samples_per_second']:.2f} Hz")
    print(f"Average Sample Time: {stats['avg_sample_time_us']:.2f} μs")
    print(f"Sample Time Range: {stats['min_sample_time_us']:.2f} to {stats['max_sample_time_us']:.2f} μs")
    
    if stats.get('avg_interval_us', 0) > 0:
        print(f"Average Interval Between Samples: {stats['avg_interval_us']:.2f} μs")
        print(f"Calculated Frequency: {stats['frequency_hz']:.2f} Hz")
    
    # Signal quality metrics
    print("\n-- SIGNAL QUALITY METRICS --")
    print(f"Mean Reading: {stats['mean']:.2f}")
    print(f"Value Range: {stats['range']:.2f} ({stats['min']} to {stats['max']})")
    print(f"Standard Deviation: {stats['std_dev']:.2f}")
    print(f"Noise Ratio: {stats['noise_ratio_percent']:.4f}%")
    print(f"Signal-to-Noise Ratio: {stats['snr_db']:.2f} dB")
    print(f"Effective Number of Bits (ENOB): {stats['enob']:.2f}")
    
    # Calculate additional metrics
    bit_resolution = math.log2(stats['range']) if stats['range'] > 0 else 0
    print(f"Theoretical Bit Resolution: {bit_resolution:.2f}")
    
    # Show histogram if enabled
    if SHOW_HISTOGRAMS and samples:
        display_ascii_histogram(samples)
        
        # Also show histogram of sample times
        if sample_times:
            print("\nSample Time Distribution (μs):")
            display_ascii_histogram(sample_times)

def run_test():
    """Run the selected sensor test"""
    print(f"\n=== Starting {SENSOR_TYPE.upper()} Test ===")
    
    if SENSOR_TYPE == "hx711":
        stats = test_hx711()
    elif SENSOR_TYPE == "nau7802":
        stats = test_nau7802()
    else:
        print(f"Unknown sensor type: {SENSOR_TYPE}")
        return
    
    print("\n=== Test Summary ===")
    print(f"Device: {SENSOR_TYPE.upper()}")
    print(f"Sample Rate: {stats['samples_per_second']:.2f} Hz")
    print(f"Noise Ratio: {stats['noise_ratio_percent']:.4f}%")
    print(f"Signal Quality (SNR): {stats['snr_db']:.2f} dB")
    print(f"Effective Resolution: {stats['enob']:.2f} bits")
    print("==============================")

# Run the test
if __name__ == "__main__":
    run_test()