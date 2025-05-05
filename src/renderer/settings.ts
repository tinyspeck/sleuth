// List of settings we don't want in main
const SETTING_DENY_LIST = ['serializedBookmarks'];

// To keep things simple, settings can only be set from the renderer
export async function setSetting(key: string, value: unknown) {
  if (SETTING_DENY_LIST.includes(key)) return;

  try {
    await window.Sleuth.setSetting(key, value);
  } catch (error) {
    console.error(`Failed to set key ${key} in main`, {
      error,
      value,
    });
  }
}
