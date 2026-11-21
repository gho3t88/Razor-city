import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const styles = readFileSync("android/app/src/main/res/values/styles.xml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.ok(manifest.includes('android:theme="@style/AppTheme.NoActionBar"'),
  "Launcher activity must use no-title-bar theme");
assert.ok(styles.includes('<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar"'),
  "The running activity must inherit a NoActionBar style");
assert.ok(styles.includes('<style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar"'),
  "Legacy launch style must not inherit a splash-screen theme");
assert.ok(!styles.includes('parent="Theme.SplashScreen"'),
  "Do not use a splash theme without installing its lifecycle handler");
assert.ok(!styles.includes("<item name=\"postSplashScreenTheme\""),
  "Post-splash theme should not be required");
assert.ok(!styles.includes("@drawable/splash"),
  "Never leave the white splash drawable as the Activity background");
assert.ok(!pkg.dependencies?.["@capacitor/splash-screen"],
  "If a splash plugin is added, revise the launcher regression test");
assert.ok(styles.includes('<item name="windowNoTitle">true</item>'));
assert.ok(styles.includes('<item name="windowActionBar">false</item>'));
console.log("PASS launcher and activity use native no-title-bar themes.");
