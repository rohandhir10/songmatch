import { songs, type Song } from "./songs.ts";

export type Genre =
  | "Pop"
  | "Rock"
  | "Soul"
  | "Country"
  | "Hindi"
  | "Latin"
  | "Classics"
  | "Disney";

export type PopularSong = Song & {
  // True = approximate range from public knowledge (keys, live footage,
  // sheet-music folklore), open to community correction. False = measured
  // from our own catalogue data. Ranges and keys are facts, not
  // copyrightable expression — no licensed content lives here.
  rangeEstimate: boolean;
  genre: Genre;
};

const estimate = (
  id: string,
  title: string,
  artist: string,
  key: string,
  vocalLowMidi: number,
  vocalHighMidi: number,
  difficulty: Song["difficulty"],
  genre: Genre
): PopularSong => {
  const span = vocalHighMidi - vocalLowMidi;
  return {
    id,
    title,
    artist,
    key,
    vocalLowMidi,
    vocalHighMidi,
    tessituraLowMidi: vocalLowMidi + Math.round(span * 0.2),
    tessituraHighMidi: vocalHighMidi - Math.round(span * 0.2),
    difficulty,
    rangeEstimate: true,
    genre,
  };
};

// Selection rule for this shelf: vocal-forward mixes with a clear,
// centered lead (ballads, piano pop, acoustic, soul). Nothing where the
// voice fights distortion, screams, mumble delivery or an EDM wall —
// the mic, the detector and any future extraction all need the singer
// audible and alone in the middle.
const shelf: PopularSong[] = [
  // ——— Pop ———
  estimate("hello", "Hello", "Adele", "F", 53, 74, "Hard", "Pop"),
  estimate("easy-on-me", "Easy On Me", "Adele", "F", 53, 72, "Medium", "Pop"),
  estimate("set-fire-to-the-rain", "Set Fire to the Rain", "Adele", "D", 50, 72, "Hard", "Pop"),
  estimate("make-you-feel-my-love", "Make You Feel My Love", "Adele", "C", 48, 67, "Easy", "Pop"),
  estimate("my-heart-will-go-on", "My Heart Will Go On", "Celine Dion", "E", 50, 74, "Hard", "Pop"),
  estimate("levitating", "Levitating", "Dua Lipa", "B", 55, 72, "Medium", "Pop"),
  estimate("dont-start-now", "Don't Start Now", "Dua Lipa", "B", 55, 72, "Medium", "Pop"),
  estimate("bad-guy", "Bad Guy", "Billie Eilish", "G", 47, 64, "Easy", "Pop"),
  estimate("drivers-license", "Drivers License", "Olivia Rodrigo", "Bb", 52, 71, "Medium", "Pop"),
  estimate("good-4-u", "Good 4 U", "Olivia Rodrigo", "A", 55, 72, "Medium", "Pop"),
  estimate("anti-hero", "Anti-Hero", "Taylor Swift", "G", 52, 69, "Easy", "Pop"),
  estimate("wrecking-ball", "Wrecking Ball", "Miley Cyrus", "D", 55, 74, "Hard", "Pop"),
  estimate("blinding-lights", "Blinding Lights", "The Weeknd", "C", 52, 71, "Medium", "Pop"),
  estimate("watermelon-sugar", "Watermelon Sugar", "Harry Styles", "A", 52, 69, "Easy", "Pop"),
  estimate("sign-of-the-times", "Sign of the Times", "Harry Styles", "F", 47, 69, "Medium", "Pop"),
  estimate("stay", "Stay", "The Kid Laroi & Justin Bieber", "C", 55, 72, "Medium", "Pop"),
  estimate("just-the-way-you-are", "Just the Way You Are", "Bruno Mars", "F", 50, 69, "Easy", "Pop"),
  estimate("grenade", "Grenade", "Bruno Mars", "D", 50, 72, "Hard", "Pop"),
  estimate("thinking-out-loud", "Thinking Out Loud", "Ed Sheeran", "G", 48, 69, "Medium", "Pop"),
  estimate("shivers", "Shivers", "Ed Sheeran", "B", 52, 71, "Medium", "Pop"),
  estimate("bad-habits", "Bad Habits", "Ed Sheeran", "B", 54, 71, "Medium", "Pop"),
  estimate("let-her-go", "Let Her Go", "Passenger", "G", 55, 71, "Medium", "Pop"),
  estimate("im-yours", "I'm Yours", "Jason Mraz", "B", 50, 67, "Easy", "Pop"),
  estimate("youre-beautiful", "You're Beautiful", "James Blunt", "E", 55, 72, "Medium", "Pop"),
  estimate("talking-to-the-moon", "Talking to the Moon", "Bruno Mars", "C", 52, 71, "Medium", "Pop"),
  estimate("dance-monkey", "Dance Monkey", "Tones and I", "F#", 57, 74, "Hard", "Pop"),
  estimate("shallow", "Shallow", "Lady Gaga & Bradley Cooper", "G", 43, 71, "Medium", "Pop"),
  estimate("always-remember-us", "Always Remember Us This Way", "Lady Gaga", "A", 52, 72, "Medium", "Pop"),
  estimate("million-reasons", "Million Reasons", "Lady Gaga", "C", 50, 69, "Easy", "Pop"),
  estimate("poker-face", "Poker Face", "Lady Gaga", "G", 52, 71, "Medium", "Pop"),

  // ——— Rock (melodic, vocal-forward) ———
  estimate("let-it-be", "Let It Be", "The Beatles", "C", 53, 72, "Easy", "Rock"),
  estimate("hey-jude", "Hey Jude", "The Beatles", "F", 55, 72, "Medium", "Rock"),
  estimate("yesterday", "Yesterday", "The Beatles", "F", 53, 67, "Easy", "Rock"),
  estimate("blackbird", "Blackbird", "The Beatles", "G", 55, 69, "Easy", "Rock"),
  estimate("imagine", "Imagine", "John Lennon", "C", 48, 65, "Easy", "Rock"),
  estimate("wonderwall", "Wonderwall", "Oasis", "F#", 54, 69, "Medium", "Rock"),
  estimate("yellow", "Yellow", "Coldplay", "B", 52, 71, "Medium", "Rock"),
  estimate("fix-you", "Fix You", "Coldplay", "Eb", 50, 69, "Medium", "Rock"),
  estimate("viva-la-vida", "Viva La Vida", "Coldplay", "Ab", 54, 71, "Medium", "Rock"),
  estimate("sky-full-of-stars", "A Sky Full of Stars", "Coldplay", "G", 54, 72, "Medium", "Rock"),
  estimate("creep", "Creep", "Radiohead", "G", 50, 74, "Hard", "Rock"),
  estimate("hallelujah", "Hallelujah", "Jeff Buckley", "C", 52, 72, "Medium", "Rock"),
  estimate("bohemian-rhapsody", "Bohemian Rhapsody", "Queen", "Bb", 47, 77, "Hard", "Rock"),
  estimate("love-of-my-life", "Love of My Life", "Queen", "C", 50, 69, "Easy", "Rock"),
  estimate("hotel-california", "Hotel California", "Eagles", "B", 48, 69, "Easy", "Rock"),
  estimate("zombie", "Zombie", "The Cranberries", "E", 52, 72, "Hard", "Rock"),

  // ——— Soul / R&B ———
  estimate("stand-by-me", "Stand By Me", "Ben E. King", "A", 45, 59, "Easy", "Soul"),
  estimate("at-last", "At Last", "Etta James", "F", 48, 70, "Medium", "Soul"),
  estimate("lean-on-me", "Lean On Me", "Bill Withers", "C", 48, 64, "Easy", "Soul"),
  estimate("aint-no-sunshine", "Ain't No Sunshine", "Bill Withers", "A", 48, 62, "Easy", "Soul"),
  estimate("isnt-she-lovely", "Isn't She Lovely", "Stevie Wonder", "E", 50, 69, "Easy", "Soul"),
  estimate("respect", "Respect", "Aretha Franklin", "C", 52, 72, "Hard", "Soul"),
  estimate("natural-woman", "(You Make Me Feel Like) A Natural Woman", "Aretha Franklin", "A", 52, 70, "Medium", "Soul"),
  estimate("i-will-always-love-you", "I Will Always Love You", "Whitney Houston", "A", 50, 76, "Hard", "Soul"),
  estimate("greatest-love-of-all", "Greatest Love of All", "Whitney Houston", "Ab", 52, 74, "Hard", "Soul"),
  estimate("halo", "Halo", "Beyoncé", "A", 52, 72, "Hard", "Soul"),
  estimate("fallin", "Fallin'", "Alicia Keys", "E", 50, 69, "Easy", "Soul"),
  estimate("if-i-aint-got-you", "If I Ain't Got You", "Alicia Keys", "G", 48, 69, "Easy", "Soul"),

  // ——— Country ———
  estimate("country-roads", "Take Me Home, Country Roads", "John Denver", "A", 48, 65, "Easy", "Country"),
  estimate("jolene", "Jolene", "Dolly Parton", "C#", 55, 70, "Medium", "Country"),
  estimate("the-gambler", "The Gambler", "Kenny Rogers", "D", 45, 62, "Easy", "Country"),
  estimate("ring-of-fire", "Ring of Fire", "Johnny Cash", "G", 43, 60, "Easy", "Country"),
  estimate("hurt-cash", "Hurt", "Johnny Cash", "A", 43, 62, "Easy", "Country"),
  estimate("wagon-wheel", "Wagon Wheel", "Darius Rucker", "A", 50, 67, "Easy", "Country"),

  // ——— Hindi (melodic, clear vocals) ———
  estimate("kal-ho-naa-ho", "Kal Ho Naa Ho", "Sonu Nigam", "C", 50, 72, "Medium", "Hindi"),
  estimate("channa-mereya", "Channa Mereya", "Arijit Singh", "C", 50, 70, "Medium", "Hindi"),
  estimate("ae-dil-hai-mushkil", "Ae Dil Hai Mushkil", "Arijit Singh", "C", 48, 69, "Medium", "Hindi"),
  estimate("agar-tum-saath-ho", "Agar Tum Saath Ho", "Alka Yagnik & Arijit Singh", "D", 50, 72, "Medium", "Hindi"),
  estimate("kesariya", "Kesariya", "Arijit Singh", "C", 50, 69, "Easy", "Hindi"),
  estimate("raabta", "Raabta", "Arijit Singh", "C", 48, 69, "Easy", "Hindi"),
  estimate("gerua", "Gerua", "Arijit Singh & Antara Mitra", "Eb", 50, 71, "Medium", "Hindi"),
  estimate("lag-jaa-gale", "Lag Jaa Gale", "Lata Mangeshkar", "C", 52, 70, "Medium", "Hindi"),
  estimate("tujhe-dekha-to", "Tujhe Dekha To", "Kumar Sanu & Alka Yagnik", "D", 48, 69, "Easy", "Hindi"),
  estimate("pehla-nasha", "Pehla Nasha", "Udit Narayan", "C", 50, 69, "Easy", "Hindi"),
  estimate("mere-sapno-ki-rani", "Mere Sapno Ki Rani", "Kishore Kumar", "C", 50, 67, "Easy", "Hindi"),
  estimate("kun-faya-kun", "Kun Faya Kun", "A.R. Rahman, Javed Ali & Mohit Chauhan", "D", 48, 71, "Medium", "Hindi"),

  // ——— Latin (melodic pop) ———
  estimate("despacito", "Despacito", "Luis Fonsi & Daddy Yankee", "B", 52, 71, "Medium", "Latin"),
  estimate("hips-dont-lie", "Hips Don't Lie", "Shakira", "Bb", 55, 72, "Medium", "Latin"),
  estimate("vivir-mi-vida", "Vivir Mi Vida", "Marc Anthony", "G", 50, 72, "Medium", "Latin"),
  estimate("senorita", "Señorita", "Shawn Mendes & Camila Cabello", "A", 52, 71, "Medium", "Latin"),
  estimate("havana", "Havana", "Camila Cabello", "G", 57, 72, "Medium", "Latin"),

  // ——— Disney ———
  estimate("let-it-go", "Let It Go", "Idina Menzel", "Ab", 53, 75, "Hard", "Disney"),
  estimate("a-whole-new-world", "A Whole New World", "Peabo Bryson & Regina Belle", "D", 50, 72, "Medium", "Disney"),
  estimate("how-far-ill-go", "How Far I'll Go", "Alessia Cara", "E", 55, 72, "Medium", "Disney"),

  // ——— Classics (standards, solo voice up front) ———
  estimate("wonderful-world", "What a Wonderful World", "Louis Armstrong", "F", 40, 57, "Easy", "Classics"),
  estimate("fly-me-to-the-moon", "Fly Me to the Moon", "Frank Sinatra", "C", 48, 64, "Easy", "Classics"),
  estimate("my-way", "My Way", "Frank Sinatra", "D", 50, 69, "Medium", "Classics"),
  estimate("cant-help-falling", "Can't Help Falling in Love", "Elvis Presley", "D", 48, 65, "Easy", "Classics"),
  estimate("sweet-caroline", "Sweet Caroline", "Neil Diamond", "B", 48, 64, "Easy", "Classics"),
  estimate("piano-man", "Piano Man", "Billy Joel", "C", 52, 69, "Easy", "Classics"),
  estimate("with-or-without-you", "With or Without You", "U2", "D", 50, 68, "Easy", "Classics"),
  estimate("one-u2", "One", "U2", "A", 48, 67, "Easy", "Classics"),
];

export const GENRES: Genre[] = [
  "Pop",
  "Rock",
  "Soul",
  "Country",
  "Hindi",
  "Latin",
  "Classics",
  "Disney",
];

export const popularSongs: PopularSong[] = [
  // Our own catalogue data first — exact, not estimates. Genre by feel.
  ...songs.map((s, i): PopularSong => ({
    ...s,
    rangeEstimate: false,
    genre: ([
      "Pop",
      "Pop",
      "Soul",
      "Soul",
      "Hindi",
      "Pop",
      "Soul",
      "Soul",
    ] as Genre[])[i] ?? "Pop",
  })),

  ...shelf,
];
