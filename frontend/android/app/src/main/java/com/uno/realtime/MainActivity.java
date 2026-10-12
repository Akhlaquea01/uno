package com.uno.realtime;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate builds the bridge.
        registerPlugin(UnoOrientationPlugin.class);
        super.onCreate(savedInstanceState);
        // A card game shouldn't dim the screen between turns.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Re-hide after dialogs, the keyboard or a swipe-revealed bar took focus.
        if (hasFocus) {
            hideSystemBars();
        }
    }

    /** Full-screen immersive mode: every pixel of a short landscape screen goes to the table. */
    private void hideSystemBars() {
        Window window = getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
