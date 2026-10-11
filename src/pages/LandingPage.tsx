import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { ProblemSection } from '../components/landing/ProblemSection';
import { HowItWorks } from '../components/landing/HowItWorks';
import { ProximityDemo } from '../components/landing/ProximityDemo';
import { FeatureGrid } from '../components/landing/FeatureGrid';
import { UseCases } from '../components/landing/UseCases';
import { PrivacySection } from '../components/landing/PrivacySection';
import { FinalCTA } from '../components/landing/FinalCTA';
import { FAQ } from '../components/landing/FAQ';

export const LandingPage: React.FC = () => {
  return (
    <div id="product">
      <HeroSection />
      <ProblemSection />
      <HowItWorks />
      <ProximityDemo />
      <FeatureGrid />
      <UseCases />
      <PrivacySection />
      <FinalCTA />
      <FAQ />
    </div>
  );
};
