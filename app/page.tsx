import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Experience, Features, FinalCta, Footer, Industries, Testimonials, Trust } from "@/components/Sections";
import { SiteMeta } from "@/components/useSiteContent";

export default function Home() {
  return (
    <>
      <SiteMeta />
      <Nav />
      <main data-lang-fade>
        <Hero />
        <Trust />
        <Industries />
        <Experience />
        <Features />
        <Testimonials />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
