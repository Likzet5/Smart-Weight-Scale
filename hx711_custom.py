import RPi.GPIO as GPIO
from hx711 import HX711

class HX711Custom:
    def __init__(self, dout_pin=5, pd_sck_pin=6):
        GPIO.setmode(GPIO.BCM)
        self.hx = HX711(dout_pin=dout_pin, pd_sck_pin=pd_sck_pin)
        err = self.hx.zero()
        if err:
            raise ValueError('Tare is unsuccessful.')
        self.hx.set_scale_ratio(14.347680890538033)  # Set the pre-determined ratio
        self.calibrated = True  # Since we set the ratio, the scale is considered calibrated

    def get_weight(self):
        if not self.calibrated:
            raise ValueError('Scale not calibrated.')
        return self.hx.get_weight_mean(1)

    def tare(self):
        self.hx.zero()
        print("Scale tared.")

    def cleanup(self):
        GPIO.cleanup()

if __name__ == "__main__":
    scale = HX711Custom(dout_pin=5, pd_sck_pin=6)
    try:
        while True:
            weight = scale.get_weight()
            print(weight, 'g')
    except (KeyboardInterrupt, SystemExit):
        print('Bye :)')
    finally:
        scale.cleanup()
