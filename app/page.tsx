import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Experience, Features, FinalCta, Footer, Industries, Testimonials, Trust } from "@/components/Sections";

export default function Home() {
  return (
    <>
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
