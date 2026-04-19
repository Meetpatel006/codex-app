import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Zap } from 'lucide-react';

export interface CTAButton {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface HeroSectionProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  primaryCta: CTAButton;
  secondaryCta: CTAButton;
  className?: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  className,
}) => {
  return (
    <section
      className={cn(
        "flex flex-col items-center justify-center min-h-[50vh] text-center p-4 sm:p-8 md:p-16 bg-background text-foreground",
        className
      )}
      role="region"
      aria-label="Product Hero Section"
    >
      <div className="max-w-4xl mx-auto">
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-6 text-muted-foreground bg-muted hover:bg-muted/70 transition-colors duration-150">
          <Zap className="h-3 w-3 mr-1.5 text-primary" aria-hidden="true" />
          Enterprise Grade Tools
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tighter mb-4 text-foreground">
          {title}
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 font-normal">
          {subtitle}
        </p>

        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          <Button
            size="lg"
            onClick={primaryCta.onClick}
            disabled={primaryCta.disabled}
            className="text-base font-semibold transition-shadow duration-200 shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={primaryCta.label}
          >
            {primaryCta.label}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={secondaryCta.onClick}
            disabled={secondaryCta.disabled}
            className="text-base font-semibold transition-colors duration-150 hover:bg-accent hover:text-accent-foreground border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={secondaryCta.label}
          >
            {secondaryCta.label}
          </Button>
        </div>
        
        <p className="mt-8 text-xs text-muted-foreground">
            Trusted by teams at Fortune 500 companies.
        </p>
      </div>
    </section>
  );
};

export default HeroSection;