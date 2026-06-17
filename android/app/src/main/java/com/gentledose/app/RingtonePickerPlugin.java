package com.gentledose.app;

import android.app.Activity;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RingtonePicker")
public class RingtonePickerPlugin extends Plugin {

    private android.media.MediaPlayer mediaPlayer;

    @PluginMethod
    public void pickRingtone(PluginCall call) {
        saveCall(call);
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Select Reminder Sound");
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true);
        
        String existingUriString = call.getString("existingUri");
        if (existingUriString != null && !existingUriString.isEmpty()) {
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(existingUriString));
        }
        
        startActivityForResult(call, intent, "ringtoneResult");
    }

    @ActivityCallback
    private void ringtoneResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            if (data != null) {
                Uri uri = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
                JSObject response = new JSObject();
                if (uri != null) {
                    response.put("uri", uri.toString());
                    Ringtone ringtone = RingtoneManager.getRingtone(getContext(), uri);
                    if (ringtone != null) {
                        response.put("title", ringtone.getTitle(getContext()));
                    } else {
                        response.put("title", "Selected Sound");
                    }
                } else {
                    response.put("uri", "");
                    response.put("title", "Silent");
                }
                call.resolve(response);
            } else {
                call.reject("No ringtone data selected");
            }
        } else {
            call.reject("Ringtone picker cancelled");
        }
    }

    @PluginMethod
    public void playRingtone(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.isEmpty()) {
            call.reject("URI is required");
            return;
        }
        
        try {
            if (mediaPlayer != null) {
                try {
                    mediaPlayer.stop();
                } catch (Exception e) {}
                mediaPlayer.release();
                mediaPlayer = null;
            }
            
            Uri uri = Uri.parse(uriString);
            mediaPlayer = new android.media.MediaPlayer();
            mediaPlayer.setDataSource(getContext(), uri);
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                android.media.AudioAttributes attributes = new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
                mediaPlayer.setAudioAttributes(attributes);
            } else {
                mediaPlayer.setAudioStreamType(android.media.AudioManager.STREAM_ALARM);
            }
            
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
            call.resolve();
        } catch (Exception e) {
            call.reject("Error playing ringtone: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        try {
            if (mediaPlayer != null) {
                try {
                    mediaPlayer.stop();
                } catch (Exception e) {}
                mediaPlayer.release();
                mediaPlayer = null;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error stopping ringtone: " + e.getMessage());
        }
    }

    @PluginMethod
    public void maximizeMediaVolume(PluginCall call) {
        try {
            android.media.AudioManager audioManager = (android.media.AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int maxVolume = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC);
                // Set to 90% of maximum volume to ensure it is clear and loud
                int targetVolume = (int) (maxVolume * 0.90);
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, targetVolume, android.media.AudioManager.FLAG_SHOW_UI);
                call.resolve();
            } else {
                call.reject("AudioManager not available");
            }
        } catch (Exception e) {
            call.reject("Error setting media volume: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openTtsSettings(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent("com.android.settings.TTS_SETTINGS");
            intent.setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open TTS settings: " + e.getMessage());
        }
    }
}
