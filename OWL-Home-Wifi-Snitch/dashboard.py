import json
from flask import Flask, render_template, redirect, url_for, request
from store import get_all_devices, get_device, acknowledge_device, set_label, get_unacknowledged_count

app = Flask(__name__)


@app.route("/")
def index():
    devices = get_all_devices()
    for d in devices:
        d["open_ports"] = json.loads(d["open_ports"]) if d["open_ports"] else []

    new_devices     = [d for d in devices if d["acknowledged"] == 0]
    unnamed_devices = [d for d in devices if d["acknowledged"] == 1 and not d["label"]]
    named_devices   = [d for d in devices if d["label"]]

    return render_template("index.html",
        devices=devices,
        new_devices=new_devices,
        unnamed_devices=unnamed_devices,
        named_devices=named_devices,
    )


@app.route("/device/<mac>")
def device_detail(mac):
    device = get_device(mac)
    if not device:
        return "Device not found", 404
    device["open_ports"] = json.loads(device["open_ports"]) if device["open_ports"] else []
    device["services"] = json.loads(device["services"]) if device.get("services") else []
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
