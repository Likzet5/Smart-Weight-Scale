# Source: electrocredible.com , Language: MicroPython
# Import necessary modules
from machine import Pin 
import bluetooth
from ble_simple_peripheral import BLESimplePeripheral
import time
import struct
from hx711_pio import HX711

# Create a Bluetooth Low Energy (BLE) object
ble = bluetooth.BLE()

# Create an instance of the BLESimplePeripheral class with the BLE object
sp = BLESimplePeripheral(ble)

# Create a Pin object for the onboard LED, configure it as an output
led = Pin("LED", Pin.OUT)

# Initialize the LED state to 0 (off)
led_state = 0
led.off()
#led.toggle()

print(ble.config('mtu'))
print(ble.active())
time.sleep(1)
#ble.config(mtu=1200)
print(ble.config('mtu'))


# Init
pin_OUT = Pin(12, Pin.IN, pull=Pin.PULL_DOWN)
pin_SCK = Pin(13, Pin.OUT)
hx711 = HX711(pin_SCK, pin_OUT, state_machine=0)

print("Tare without weight")
led.toggle()
time.sleep_ms(3500)
hx711.tare()
print("Tared")
led.toggle()
time.sleep_ms(100)
#offset = hx711.read_average()
# hx711.set_offset(offset)
#time.sleep_ms(100)
# print("Offset set ", offset)
print("Setting Scale put on 2,5Kg Weight!")
led.toggle()
time.sleep_ms(4500)
scale = hx711.get_value() * 1.554606 * .1 #* 2.573 # In grams
time.sleep_ms(500)
hx711.set_scale(scale)     # Scale:  9846.984
print("Scale: ", scale)
time.sleep_ms(500)
print("Finished")
led.off()
# Init finished
time.sleep_ms(100)

last_time = time.ticks_ms
counter = 0

# Define a callback function to handle received data
def on_rx(data):
    print("Data received:", data)  # Print the received data
    #sp.send(data)
    global led_state  # Access the global variable led_state
    if data == b'toggle':  # Check if the received data is "toggle"
        led.toggle()
        #led.value(not led_state)  # Toggle the LED state (on/off)
        #led_state = 1 - led_state  # Update the LED state

# Start an infinite loop


#if __name__ == "__boot__":
current_time = time.time()
led.toggle()
while True:
    if sp.is_connected():  # Check if a BLE connection is established
        # print(ble.config('mtu'))
        times = 3
        sum = 0
        for i in range(times):
            sum += hx711.get_units()
        average_units = sum / times
        #print("Average units ", average_units)
        print("Average units INT ", int(average_units))
        #sp.send(struct.pack("<h", int(average_units)))
        #time.sleep_ms(50)
        
        print("C ", counter, " Time ", current_time)
        data = f"C {counter} Time {current_time})"
        sp.send(data.encode('utf8'))
        counter += 1
        #last_time = time.ticks_ms
        #sp.send(str(int(average_units)).encode('utf8'))
        
        print("C ", counter, " Time ", current_time)
        data = f"C {counter} Time {current_time})"
        sp.send(data.encode('utf8'))
        counter += 1

        if current_time != time.time():
            current_time = time.time()
            counter = 0
        sp.on_write(on_rx)  # Set the callback function for data reception



