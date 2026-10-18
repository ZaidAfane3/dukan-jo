import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Brands, Features, FinalCta, Footer, Industries, Pricing, Stats, Testimonials } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <Brands />
        <Industries />
        <Features />
        <Pricing />
        <Testimonials />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
