// Silly fish-pun names handed out to bots so the room doesn't read as a
// row of colour swatches. Picked once per bot at spawn/respawn.
export const FISH_NAMES = [
  "Gill-bert", "Cod Almighty", "Fin Diesel", "Sammy Salmon", "Barry Cuda",
  "Eel Musk", "Sharkira", "Mackerel Jackson", "Tuna Turner", "Carp Diem",
  "Fishtopher", "Swim Shady", "Troutman", "Salmon Rushdie", "Codfather",
  "Gillian", "Sting Ray", "Pike Newton", "Herman Herring", "Perch Perry",
  "Flounder Powers", "Clownfish Carl", "Fishy McFishface", "Ariel Fin",
  "Bass Pitt", "Moby", "Captain Haddock", "Otto Octopus", "Reel Talk",
  "Anna Conda",
];

export function randomFishName() {
  return FISH_NAMES[Math.floor(Math.random() * FISH_NAMES.length)];
}
