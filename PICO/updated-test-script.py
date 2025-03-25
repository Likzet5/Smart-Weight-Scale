# adc_performance_test.py - Single-ADC performance testing with comprehensive output
import time
from machine import Pin, I2C
import gc
import math
from nau7802driver import NAU7802, NAU7802_GAIN_128, NAU7802_RATE_80SPS, NAU7802_CALMOD_INTERNAL, NAU7802_RATE_320SPS

# Configuration
SENSOR_TYPE = "nau7802"  # Change to "hx711" for HX711 test
TEST_DURATION_SEC = 10
SAMPLE_COUNT = 3000
SHOW_HISTOGRAMS = True  # Set to True to display ASCII histograms

# HX711 pins
HX711_DOUT_PIN = 12
HX711_SCK_PIN = 13

# NAU7802 pins
NAU_SDA_PIN = 4
NAU_SCL_PIN = 5

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

def init_nau7802():
    """Initialize NAU7802 with the new driver"""
    print(f"Initializing NAU7802 (SDA={NAU_SDA_PIN}, SCL={NAU_SCL_PIN})")
    
    # Create I2C instance
    i2c = I2C(0, sda=Pin(NAU_SDA_PIN), scl=Pin(NAU_SCL_PIN), freq=600000)
    
    # Create NAU7802 instance
    nau = NAU7802(i2c)
    
    # Initialize and configure
    if not nau.begin():
        print("Failed to initialize NAU7802!")
        return None
    
    # Configure settings
    nau.setGain(NAU7802_GAIN_128)
    nau.setRate(NAU7802_RATE_320SPS)  # Using 80SPS as in the original script
    
    # Perform calibration
    print("Calibrating NAU7802...")
    if nau.calibrate(NAU7802_CALMOD_INTERNAL):
        print("Calibration successful!")
    else:
        print("Calibration failed!")
    
    # Verify configuration
    print(f"Gain set to: {nau.getGain()}")
    print(f"Sample rate set to: {nau.getRate()}")
    
    print("Performing initial warmup readings...")
    for _ in range(2):
        if nau.available():
            nau.read()
            time.sleep_ms(1)

    return nau

def read_nau7802(nau):
    """Read value from NAU7802 using the new driver"""
    if nau.available():
        return nau.read()
    return None

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
    """Run NAU7802 performance test using the new driver"""
    global timestamps
    nau = init_nau7802()
    
    if nau is None:
        print("Failed to initialize NAU7802, skipping test")
        return {}
    
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
        
        # Get reading (check if data is available)
        reading = None
        while reading is None:
            reading = read_nau7802(nau)
            
            # Check if test is taking too long
            if time.time() - start_time > TEST_DURATION_SEC:
                break
        
        if reading is not None:
            current_time = time.ticks_us()
            
            # Filter out extreme outliers (values outside reasonable 24-bit signed range)
            if -8388608 <= reading <= 8388607:  # Valid 24-bit signed integer range
                # Store data
                samples.append(reading)
                sample_times.append(time.ticks_diff(current_time, sample_start))
                timestamps.append(current_time)
                sample_count += 1
            else:
                print(f"Filtered outlier: {reading}")
            
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
