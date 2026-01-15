'use client';

import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import PixelSnow from '@/components/react-bits/PixelSnow';
import GlassNav from './GlassNav';
import RotatingText from '@/components/react-bits/RotatingText';
import GlareHover from '@/components/react-bits/GlareHover';

export interface HeroProps {
  navItems: Array<{
    label: string;
    bgColor: string;
    textColor: string;
    links: Array<{
      label: string;
      href: string;
      ariaLabel: string;
    }>;
  }>;
  className?: string;
}

export default function Hero({ navItems, className = '' }: HeroProps) {
  const { scrollY } = useScroll();

  // Parallax transforms - different speeds for depth effect
  const yBackground = useTransform(scrollY, [0, 1000], [0, 200]);
  const yContent = useTransform(scrollY, [0, 1000], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);

  return (
    <section className={`relative min-h-screen w-full bg-background overflow-hidden ${className}`}>
      {/* PixelSnow Background with Parallax */}
      <motion.div style={{ y: yBackground }} className='absolute inset-0'>
        <PixelSnow
          color='#60a5fa'
          variant='square'
          speed={0.6}
          density={0.25}
          direction={125}
          brightness={1}
          className='z-0'
          pixelResolution={200}
          farPlane={20}
        />
      </motion.div>

      {/* Glass Navigation */}
      <GlassNav items={navItems} />

      {/* Hero Content with Parallax */}
      <motion.div
        style={{ y: yContent, opacity, scale }}
        className='relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-32 pb-20'>
        {/* Main Title with Space Grotesk */}
        <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-8 text-foreground leading-tight font-grotesk'>
          Send Stablecoin without being watched
        </h1>

        {/* Subtitle with Poppins */}
        <p className='text-lg md:text-xl lg:text-2xl text-muted-foreground text-center max-w-3xl mb-12 leading-relaxed font-poppins'>
          Private Stablecoin payments on Base. No KYC, no tracking, just you and the recipient.
        </p>

        {/* CTA with Glare Hover */}
        <GlareHover
          width='fit-content'
          height='fit-content'
          background='oklch(var(--primary))'
          borderRadius='0.5rem'
          borderColor='oklch(var(--primary))'
          glareColor='#ffffff'
          glareOpacity={0.8}
          glareAngle={-45}
          glareSize={300}
          transitionDuration={1000}
          className='px-10 py-6 shadow-2xl font-poppins'>
          <RotatingText
            texts={['Claim Your Username', 'Start Private Payments', 'Join Ninah Today']}
            mainClassName='text-lg font-semibold text-foreground justify-center'
            rotationInterval={4000}
            staggerDuration={0.02}
            staggerFrom='first'
          />
        </GlareHover>
      </motion.div>

      {/* Bottom gradient overlay */}
      <div className='absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-[5]' />
    </section>
  );
}
