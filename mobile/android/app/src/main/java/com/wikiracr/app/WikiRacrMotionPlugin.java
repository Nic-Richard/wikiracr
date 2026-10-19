package com.wikiracr.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import android.view.Surface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WikiRacrMotion")
public class WikiRacrMotionPlugin extends Plugin implements SensorEventListener {
    private SensorManager manager;
    private Sensor sensor;
    private boolean active;
    private boolean calibrated;
    private double neutralX, neutralY, smoothX, smoothY;
    private long lastSample;
    private int lastRotation = -1;

    @Override public void load() {
        manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        sensor = manager.getDefaultSensor(Sensor.TYPE_GRAVITY);
    }

    @PluginMethod public void start(PluginCall call) {
        active = sensor != null;
        calibrated = false;
        boolean available = active && manager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME);
        active = available;
        call.resolve(new JSObject().put("available", available));
    }

    @PluginMethod public void stop(PluginCall call) {
        active = false;
        manager.unregisterListener(this);
        call.resolve();
    }

    @Override public void onSensorChanged(SensorEvent event) {
        long now = SystemClock.elapsedRealtime();
        if (now - lastSample < 50) return;
        lastSample = now;
        double x = event.values[0], y = event.values[1], z = event.values[2];
        int rotation = getActivity().getWindowManager().getDefaultDisplay().getRotation();
        if (rotation != lastRotation) { calibrated = false; lastRotation = rotation; }
        double displayX = x, displayY = y;
        if (rotation == Surface.ROTATION_90) { displayX = -y; displayY = x; }
        else if (rotation == Surface.ROTATION_180) { displayX = -x; displayY = -y; }
        else if (rotation == Surface.ROTATION_270) { displayX = y; displayY = -x; }
        double roll = Math.toDegrees(Math.atan2(displayX, Math.hypot(displayY, z)));
        double pitch = Math.toDegrees(Math.atan2(displayY, z));
        if (!calibrated) {
            neutralX = roll; neutralY = pitch;
            smoothX = 0; smoothY = 0;
            calibrated = true;
        }
        double deltaY = ((pitch - neutralY + 540) % 360) - 180;
        smoothX += (Math.max(-0.5, Math.min(0.5, (roll - neutralX) / 18)) - smoothX) * 0.18;
        smoothY += (Math.max(-0.5, Math.min(0.5, deltaY / 18)) - smoothY) * 0.18;
        notifyListeners("tilt", new JSObject().put("x", smoothX).put("y", smoothY));
    }

    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}
    @Override protected void handleOnPause() { manager.unregisterListener(this); }
    @Override protected void handleOnResume() {
        if (active) { calibrated = false; manager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME); }
    }
    @Override protected void handleOnDestroy() { manager.unregisterListener(this); }
}
