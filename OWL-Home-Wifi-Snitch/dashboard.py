import json
from flask import Flask, render_template, redirect, url_for, request
from store import get_all_devices, get_device, acknowledge_device, set_label, get_unacknowledged_count

app = Flask(__name__)


@app.route("/")
def index():
    devices = get_all_devices()
    for d in devices:
        d["open_ports"] = json.loads(d["open_ports"]) if d["open_ports"] else []
    unack_count = get_unacknowledged_count()
    return render_template("index.html", devices=devices, unack_count=unack_count)


@app.route("/device/<mac>")
def device_detail(mac):
    device = get_device(mac)
    if not device:
        return "Device not found", 404
    device["open_ports"] = json.loads(device["open_ports"]) if device["open_ports"] else []
    return render_template("device.html", device=device)


@app.route("/device/<mac>/label", methods=["POST"])
def update_label(mac):
    label = request.form.get("label", "").strip()
    set_label(mac, label)
    return redirect(url_for("device_detail", mac=mac))


@app.route("/device/<mac>/acknowledge", methods=["POST"])
def acknowledge(mac):
    acknowledge_device(mac)
    return redirect(url_for("index"))
