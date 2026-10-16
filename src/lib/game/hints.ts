export function hiddenHintText(name: string) {
  const letter = [...name.trim()][0]?.toLocaleUpperCase("en");
  return letter ? `The name starts with ${letter}.` : "No hidden hint is available.";
}
