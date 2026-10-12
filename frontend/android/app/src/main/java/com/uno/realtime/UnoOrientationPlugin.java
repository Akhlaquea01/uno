package com.uno.realtime;

import android.content.pm.ActivityInfo;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Locks the activity to landscape in either direction. Capacitor's stock
 * screen-orientation plugin maps "landscape" to a single fixed direction, which
 * leaves the table upside-down when the phone is held the other way up.
 * SENSOR_LANDSCAPE also ignores the system auto-rotate toggle, so the game
 * never dead-ends on a "rotate your device" screen.
 */
@CapacitorPlugin(name = "UnoOrientation")
public class UnoOrientationPlugin extends Plugin {

    @PluginMethod
    public void lockLandscape(PluginCall call) {
        setOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE, call);
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        setOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, call);
    }

    private void setOrientation(int orientation, PluginCall call) {
        // Plugin methods run off the main thread; the activity must be touched on it.
        getActivity().runOnUiThread(() -> {
            getActivity().setRequestedOrientation(orientation);
            call.resolve();
        });
    }
}
