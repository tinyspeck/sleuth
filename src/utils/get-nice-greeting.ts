import { getRandomNumber } from './random';

/**
 * Get a random nice greeting
 *
 * @export
 * @returns
 */
export function getNiceGreeting() {
  const today = new Date();
  let greetings = [''];
  if (today.getMonth() === 1 && today.getDate() === 12) {
    greetings = ['🎂 Happy birthday, Slack'];
  } else {
    greetings = [
      '👋 Thanks for checking out logs',
      '💖 You got this',
      `💖 We think you're great`,
      '🤘 You rock, we know it',
      '🙇‍♀️ Thanks for trying out Sleuth',
      '🐕 Go pet a dog today',
      '🐈 Go pet a cat today',
      '💧 Stay hydrated',
      '🙇‍♂️ Many thanks from the desktop team',
      '🐙 The world is your oyster',
      '🌅 Have a wonderful day',
    ];
  }

  const min = 0;
  const max = greetings.length;

  return greetings[getRandomNumber(min, max)];
}
