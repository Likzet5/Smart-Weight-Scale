from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit
import time
import threading
from collections import deque
from hx711_custom import HX711Custom
import numpy as np
import psutil


app = Flask(__name__)
socketio = SocketIO(app)

# Initialize the scale
scale = HX711Custom(dout_pin=5, pd_sck_pin=6)

# Global variables
weights = deque(maxlen=100)  # Use deque with a max length to limit memory usage
peak_weight = 0
tracking = False
start_time = 0
off_time = 0
tracking_duration = 0
min_weight = 500  # Default minimum weight to start the timer
current_weight = 1
raw_weights = deque(maxlen=1000)  # A larger buffer to hold raw data for filtering

def print_memory_usage():
    process = psutil.Process()
    print(f"Memory Usage: {process.memory_info().rss / 1024 ** 2:.2f} MB")


def rolling_median_filter(data, window_size):
    if len(data) < window_size:
        return data[-1]  # Not enough data points to apply the filter
    window = np.array(list(data)[-window_size:])
    median = np.median(window)
    return median



def read_sensor():
    global peak_weight, start_time, tracking, tracking_duration, current_weight, off_time
    window_size = 3
    last_emit_time = 0
    emit_interval = 0.025  # seconds

    while True:
        print_memory_usage()
        try:
            weight = scale.get_weight()
            if weight is False or weight < 0:
                weight = current_weight

            current_weight = weight

            if weight is not None:
                raw_weights.append(weight)
                smoothed_weight = rolling_median_filter(raw_weights, window_size)
                if np.abs(weight - smoothed_weight) > 3 * np.std(raw_weights):
                    continue

                if smoothed_weight > min_weight and (time.time() - off_time > 2):
                    if not tracking:
                        off_time = 0
                        tracking = True
                        weights.clear()
                        peak_weight = 0
                        start_time = time.time()

                    weights.append(weight)

                    if smoothed_weight > peak_weight:
                        peak_weight = smoothed_weight

                    if (time.time() - start_time > tracking_duration) and tracking_duration != 0:
                        tracking = False
                        start_time = 0
                        if off_time == 0:
                            off_time = time.time()

                else:
                    tracking = False
                    start_time = 0

                # Emit data at intervals
                current_time = time.time()
                if current_time - last_emit_time >= emit_interval:
                    last_emit_time = current_time
                    avg_weight = round(sum(weights) / len(weights) / 1000, 1) if weights else 0
                    elapsed_time = round(time.time() - start_time, 2) if start_time and tracking else 0
                    response = {
                        'weight': round(current_weight / 1000, 1),
                        'peak_weight': round(peak_weight / 1000, 1),
                        'avg_weight': avg_weight,
                        'elapsed_time': elapsed_time,
                        'tracking': tracking,
                        'clear_chart': len(weights) == 1
                    }
                    socketio.emit('response_data', response)
                    
        except ValueError as e:
            print(f"Error reading weight: {e}")
        time.sleep(emit_interval)  # Adjust the sleep interval as needed

thread = threading.Thread(target=read_sensor)
thread.daemon = True
thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


@socketio.on('request_data')
def handle_request_data():
    global weights, peak_weight, start_time, current_weight
    avg_weight = round(sum(weights) / len(weights) / 1000, 1) if weights else 0
    elapsed_time = round(time.time() - start_time, 2) if start_time and tracking else 0
    response = {
        'weight': round(current_weight / 1000, 1),
        'peak_weight': round(peak_weight / 1000, 1),
        'avg_weight': avg_weight,
        'elapsed_time': elapsed_time,
        'tracking': tracking,
        'clear_chart': len(weights) == 1  # Clear chart if only one weight entry (new tracking started)
    }
    emit('response_data', response)

@socketio.on('set_min_weight')
def handle_set_min_weight(json):
    global min_weight
    data = request.get_json()
    min_weight = float(data['min_weight'])
    emit('min_weight_set', {'status': 'success', 'min_weight': min_weight})

@socketio.on('set_tracking_duration')
def handle_set_tracking_duration(json):
    global tracking_duration
    data = request.get_json()
    tracking_duration = float(data['tracking_duration'])
    emit('tracking_duration_set', {'status': 'success', 'tracking_duration': tracking_duration})

@socketio.on('tare')
def handle_tare():
    scale.tare()
    emit('tared', {'status': 'success', 'message': 'Scale tared'})

@socketio.on('is_calibrated')
def handle_is_calibrated():
    emit('calibration_status', {'calibrated': scale.is_calibrated()})

if __name__ == '__main__':
    try:
        # Use 'localhost' or '127.0.0.1' for testing
        # app.run(host='192.168.1.41', port=5000)
        socketio.run(app, host='192.168.1.41', port=5000)
    except (KeyboardInterrupt, SystemExit):
        print('Bye :)')
    finally:
        scale.cleanup()
