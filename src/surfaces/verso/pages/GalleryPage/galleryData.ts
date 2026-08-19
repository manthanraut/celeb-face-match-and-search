export type GalleryImage = Readonly<{
  alt: string;
  caption: string;
  credit: string;
  id: string;
  src: string;
}>;

const imageUrl = (id: string) =>
  "https://assets.vogue.com/photos/" + id + "/2:3/w_960,c_limit/" + id;

export const gallery = {
  author: {
    bio: "Hannah Jackson is a senior fashion writer at Vogue covering celebrity style, trends, and culture. Her writing has appeared across leading fashion and culture publications, and she is based in New York.",
    image: {
      alt: "Portrait of Vogue writer Hannah Jackson.",
      src: "https://assets.vogue.com/photos/665c79192a211a1c3e770ff1/1:1/w_350,c_limit/Screen%20Shot%202024-06-02%20at%209.52.09%20AM.png",
    },
    name: "Hannah Jackson",
    profileUrl: "https://www.vogue.com/contributor/hannah-jackson",
  },
  category: "Met Gala",
  description:
    "Fashion’s biggest night returned to New York with an artful red carpet. Explore the evening’s standout arrivals, then discover every photograph of the celebrities you follow.",
  images: [
    {
      alt: "Emma Chamberlain arriving at the 2026 Met Gala.",
      caption: "Emma Chamberlain in Mugler and Chopard.",
      credit: "Photo: Getty Images",
      id: "69f8fec5a28ab91d7a74861a",
      src: imageUrl("69f8fec5a28ab91d7a74861a"),
    },
    {
      alt: "Ashley Graham posing on the 2026 Met Gala red carpet.",
      caption: "Ashley Graham in Di Petsa.",
      credit: "Photo: Getty Images",
      id: "69f9022567979e8723db7aa6",
      src: imageUrl("69f9022567979e8723db7aa6"),
    },
    {
      alt: "Cara Delevingne arriving at the 2026 Met Gala.",
      caption: "Cara Delevingne in Ralph Lauren and De Beers London.",
      credit: "Photo: Getty Images",
      id: "69f90406a0f8d1dd04d7df05",
      src: imageUrl("69f90406a0f8d1dd04d7df05"),
    },
    {
      alt: "Nicole Kidman posing on the 2026 Met Gala red carpet.",
      caption: "Nicole Kidman in Chanel.",
      credit: "Photo: Getty Images",
      id: "69f90c14c94d7b6b49611ecd",
      src: imageUrl("69f90c14c94d7b6b49611ecd"),
    },
    {
      alt: "Venus Williams arriving at the 2026 Met Gala.",
      caption: "Venus Williams in Swarovski.",
      credit: "Photo: Getty Images",
      id: "69f90d6dcd7f00bc4b68bfa1",
      src: imageUrl("69f90d6dcd7f00bc4b68bfa1"),
    },
    {
      alt: "Bill Skarsgård posing on the 2026 Met Gala red carpet.",
      caption: "Bill Skarsgård in Thom Browne.",
      credit: "Photo: Getty Images",
      id: "69f90e982bb16669f9220662",
      src: imageUrl("69f90e982bb16669f9220662"),
    },
    {
      alt: "Doja Cat arriving at the 2026 Met Gala.",
      caption: "Doja Cat in Saint Laurent.",
      credit: "Photo: Getty Images",
      id: "69f915f0c7395d3400322875",
      src: imageUrl("69f915f0c7395d3400322875"),
    },
    {
      alt: "Gigi Hadid posing on the 2026 Met Gala red carpet.",
      caption: "Gigi Hadid in Miu Miu and Jessica McCormack.",
      credit: "Photo: Getty Images",
      id: "69f9215f9f1254680e115916",
      src: imageUrl("69f9215f9f1254680e115916"),
    },
    {
      alt: "Kendall Jenner arriving at the 2026 Met Gala.",
      caption: "Kendall Jenner in GapStudio and Buccellati.",
      credit: "Photo: Getty Images",
      id: "69f93498b619fe08695ec647",
      src: imageUrl("69f93498b619fe08695ec647"),
    },
    {
      alt: "Rihanna posing on the 2026 Met Gala red carpet.",
      caption:
        "Rihanna in Maison Margiela, with jewelry by Glenn Spiro and Fred Leighton.",
      credit: "Photo: Getty Images",
      id: "69f944e4d3920bc0f1e59746",
      src: imageUrl("69f944e4d3920bc0f1e59746"),
    },
  ] satisfies readonly GalleryImage[],
  introduction: [
    "The 2026 Met Gala celebrated Costume Art, inviting guests to treat the dressed body as a canvas. The result was a red carpet shaped by dramatic silhouettes, intricate craft, and highly personal interpretations of the theme.",
    "This prototype turns that visual coverage into a searchable experience. Browse the gallery, then use celebrity recognition to find appearances across the wider photo archive.",
  ],
  publishedDate: new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date("2026-05-05T00:00:00Z")),
  title: "See Every Look from the 2026 Met Gala Red Carpet",
  topics: ["Met Gala 2026"],
} as const;
