//! Writes the wallpaper and accent into the current Windows user. HKCU only.

#[cfg(windows)]
use std::path::{Path, PathBuf};

#[cfg(windows)]
mod win {
    use super::*;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_BINARY, REG_DWORD, REG_OPTION_NON_VOLATILE, REG_SZ, REG_VALUE_TYPE,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        SendMessageTimeoutW, SystemParametersInfoW, HWND_BROADCAST, SMTO_ABORTIFHUNG,
        SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, WM_SETTINGCHANGE,
    };

    pub fn install_wallpaper(bytes: &[u8], ext: &str) -> Result<String, String> {
        let path = store(bytes, ext)?;
        set_wallpaper(&path)?;
        Ok(format!("Wallpaper: {}", path.display()))
    }

    pub fn install_accent(rgb: [u8; 3]) -> Result<String, String> {
        unsafe { write_accent(rgb) }
    }

    fn store(bytes: &[u8], ext: &str) -> Result<PathBuf, String> {
        let profile = std::env::var("USERPROFILE").map_err(|_| "USERPROFILE is missing.".to_string())?;
        let dir = PathBuf::from(profile).join("Pictures").join("Aether");
        std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
        let dest = dir.join("wallpaper").with_extension(ext);
        std::fs::write(&dest, bytes).map_err(|error| error.to_string())?;
        Ok(dest)
    }

    fn set_wallpaper(path: &Path) -> Result<(), String> {
        let wide = wide(&path.display().to_string());
        unsafe {
            set_sz(r"Control Panel\Desktop", "WallpaperStyle", "10")?;
            set_sz(r"Control Panel\Desktop", "TileWallpaper", "0")?;
            SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                Some(wide.as_ptr() as *mut _),
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            )
            .map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    unsafe fn write_accent(rgb: [u8; 3]) -> Result<String, String> {
        let shades = accent_shades(rgb);
        let mut palette = Vec::with_capacity(32);
        for color in shades {
            palette.extend_from_slice(&[color[0], color[1], color[2], 255]);
        }
        let abgr = dword(0xff, rgb[2] as u32, rgb[1] as u32, rgb[0] as u32);
        let argb = dword(0xc4, rgb[0] as u32, rgb[1] as u32, rgb[2] as u32);
        set_dword(r"Control Panel\Desktop", "AutoColorization", 0)?;
        set_binary(
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent",
            "AccentPalette",
            &palette,
        )?;
        set_dword(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent", "AccentColorMenu", abgr)?;
        set_dword(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent", "StartColorMenu", abgr)?;
        set_dword(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 0)?;
        set_dword(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "SystemUsesLightTheme", 0)?;
        set_dword(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "EnableTransparency", 1)?;
        set_dword(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "ColorPrevalence", 1)?;
        set_dword(r"Software\Microsoft\Windows\DWM", "ColorPrevalence", 1)?;
        set_dword(r"Software\Microsoft\Windows\DWM", "AccentColor", abgr)?;
        set_dword(r"Software\Microsoft\Windows\DWM", "ColorizationColor", argb)?;
        set_dword(r"Software\Microsoft\Windows\DWM", "ColorizationAfterglow", argb)?;
        set_dword(r"Software\Microsoft\Windows\DWM", "ColorizationColorBalance", 89)?;
        set_dword(r"Software\Microsoft\Windows\DWM", "EnableWindowColorization", 1)?;
        let param = wide("ImmersiveColorSet");
        let _ = SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            WPARAM(0),
            LPARAM(param.as_ptr() as isize),
            SMTO_ABORTIFHUNG,
            1500,
            None,
        );
        Ok(format!("Accent #{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]))
    }

    unsafe fn set_sz(path: &str, name: &str, value: &str) -> Result<(), String> {
        let key = create_key(path)?;
        let name = wide(name);
        let mut data = wide(value);
        data.push(0);
        let bytes = std::slice::from_raw_parts(data.as_ptr() as *const u8, data.len() * 2);
        let result = RegSetValueExW(key, PCWSTR(name.as_ptr()), 0, REG_SZ, Some(bytes));
        let _ = RegCloseKey(key);
        win_ok(result)
    }

    unsafe fn set_dword(path: &str, name: &str, value: u32) -> Result<(), String> {
        write_value(path, name, REG_DWORD, &value.to_le_bytes())
    }

    unsafe fn set_binary(path: &str, name: &str, value: &[u8]) -> Result<(), String> {
        write_value(path, name, REG_BINARY, value)
    }

    unsafe fn write_value(path: &str, name: &str, kind: REG_VALUE_TYPE, bytes: &[u8]) -> Result<(), String> {
        let key = create_key(path)?;
        let name = wide(name);
        let result = RegSetValueExW(key, PCWSTR(name.as_ptr()), 0, kind, Some(bytes));
        let _ = RegCloseKey(key);
        win_ok(result)
    }

    unsafe fn create_key(path: &str) -> Result<HKEY, String> {
        let path = wide(path);
        let mut key = HKEY::default();
        let code = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(path.as_ptr()),
            0,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        );
        win_ok(code)?;
        Ok(key)
    }

    fn win_ok(code: windows::Win32::Foundation::WIN32_ERROR) -> Result<(), String> {
        if code.0 == 0 {
            Ok(())
        } else {
            Err(format!("Windows registry error {}", code.0))
        }
    }
}

#[cfg(not(windows))]
mod host {
    pub fn install_wallpaper(_bytes: &[u8], _ext: &str) -> Result<String, String> {
        Err("Wallpaper apply runs on Windows.".into())
    }

    pub fn install_accent(_rgb: [u8; 3]) -> Result<String, String> {
        Err("Accent apply runs on Windows.".into())
    }
}

#[cfg(windows)]
pub use win::{install_accent, install_wallpaper};
#[cfg(not(windows))]
pub use host::{install_accent, install_wallpaper};

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn dword(a: u32, b: u32, c: u32, d: u32) -> u32 {
    (a << 24) | (b << 16) | (c << 8) | d
}

#[cfg(windows)]
fn accent_shades(rgb: [u8; 3]) -> [[u8; 3]; 8] {
    [
        shade(rgb, 0.72),
        shade(rgb, 0.48),
        shade(rgb, 0.24),
        rgb,
        shade(rgb, -0.18),
        shade(rgb, -0.38),
        shade(rgb, -0.58),
        rgb,
    ]
}

#[cfg(windows)]
fn shade(rgb: [u8; 3], toward: f32) -> [u8; 3] {
    let target = if toward > 0.0 { 255 } else { 0 };
    let t = toward.abs();
    [
        mix_channel(rgb[0], target, t),
        mix_channel(rgb[1], target, t),
        mix_channel(rgb[2], target, t),
    ]
}

#[cfg(windows)]
fn mix_channel(from: u8, to: u8, t: f32) -> u8 {
    (from as f32 + (to as f32 - from as f32) * t).round().clamp(0.0, 255.0) as u8
}
