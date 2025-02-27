import * as amplitude from '@amplitude/analytics-browser';

class AmplitudeAnalytics {
  private static instance: AmplitudeAnalytics;
  private initialized = false;

  private constructor() {}

  public static getInstance(): AmplitudeAnalytics {
    if (!AmplitudeAnalytics.instance) {
      AmplitudeAnalytics.instance = new AmplitudeAnalytics();
    }
    return AmplitudeAnalytics.instance;
  }

  public init() {
    if (!this.initialized && typeof window !== 'undefined') {
      const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
      
      if (!apiKey) {
        console.warn('Amplitude API key not found');
        return;
      }

      try {
        amplitude.init(apiKey, {
          defaultTracking: {
            sessions: true,
            pageViews: true,
            formInteractions: true,
            fileDownloads: true,
          },
        });
        this.initialized = true;
      } catch (error) {
        console.error('Failed to initialize Amplitude:', error);
      }
    }
  }

  public trackEvent(eventName: string, eventProperties?: Record<string, any>) {
    if (typeof window !== 'undefined' && this.initialized) {
      try {
        amplitude.track(eventName, {
          ...eventProperties,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV
        });
      } catch (error) {
        console.error('Failed to track event:', error);
      }
    }
  }

  public setUserProperties(properties: Record<string, any>) {
    if (typeof window !== 'undefined' && this.initialized) {
      try {
        const identify = new amplitude.Identify();
        amplitude.identify(identify, properties);
      } catch (error) {
        console.error('Failed to set user properties:', error);
      }
    }
  }

  public setUserId(userId: string) {
    if (typeof window !== 'undefined' && this.initialized) {
      try {
        amplitude.setUserId(userId);
      } catch (error) {
        console.error('Failed to set user ID:', error);
      }
    }
  }
}

export const amplitudeAnalytics = AmplitudeAnalytics.getInstance(); 