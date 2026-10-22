import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Experience, Features, FinalCta, Footer, Industries, Testimonials } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main data-lang-fade>
        <Hero />
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
