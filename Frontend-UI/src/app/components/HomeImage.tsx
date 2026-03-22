"use client"
import { Suspense } from 'react';
import Image from 'next/image';

const HomeImage = () => {
  return (
    <section className="aboutContainer container"  
             style={{ backgroundImage: "url('/images/bg.png')" }}>
        <Suspense fallback={<p>Loading...</p>}>
        <div className="homeImageContainer">
            <Image
              className="homeImage"
              src="/images/bg.png"
              alt="logo"
              width={500}
              height={350}
              priority
            />
          </div>
        </Suspense>
    </section>
  );
};

export default HomeImage;
