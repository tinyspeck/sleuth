export function getSleuth(
  platform: string = window.Sleuth.platform
) {
  let sleuths = [
    '🕵',
    '🕵️‍♀️',
    '🕵🏻',
    '🕵🏼',
    '🕵🏽',
    '🕵🏾',
    '🕵🏿',
    '🕵🏻‍♀️',
    '🕵🏼‍♀️',
    '🕵🏽‍♀️',
    '🕵🏾‍♀️',
    '🕵🏿‍♀️',
  ];

  if (platform === 'darwin') {
    return sleuths[Math.floor(Math.random() * 11) + 1];
  } else if (platform === 'win32') {
    sleuths = ['🕵', '🕵🏻', '🕵🏼', '🕵🏽', '🕵🏾', '🕵🏿'];
    return sleuths[Math.floor(Math.random() * 5) + 1];
  } else {
    return sleuths[Math.round(Math.random())];
  }
}
