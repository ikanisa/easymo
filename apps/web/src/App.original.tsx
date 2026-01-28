import { useState } from 'react';
import MoltbotMarketplace from './components/MoltbotMarketplace';
import OnboardingWizard from './components/wizards/OnboardingWizard';
import ListingCreationWizard from './components/wizards/ListingCreationWizard';
import SuccessScreen from './components/wizards/SuccessScreen';

const App = () => {
    // Default to onboarding for new users (simulated)
    const [viewMode, setViewMode] = useState<'marketplace' | 'onboarding' | 'listing-wizard'>('onboarding');
    const [successType, setSuccessType] = useState<'listing' | 'request' | 'verification' | null>(null);

    const handleListingWizardComplete = (data: any) => {
        console.log('Listing created:', data);
        // Here we would send data to backend
        setSuccessType('listing');
        setViewMode('marketplace');
    };

    const handleOnboardingComplete = () => {
        setViewMode('marketplace');
    };

    const handleError = (error: Error) => { // Basic error boundary placeholder
        console.error(error);
    };

    return (
        <>
            <div className="app-container">
                {viewMode === 'onboarding' && (
                    <OnboardingWizard onComplete={handleOnboardingComplete} />
                )}

                {viewMode === 'listing-wizard' && (
                    <ListingCreationWizard onComplete={handleListingWizardComplete} />
                )}

                {viewMode === 'marketplace' && (
                    <MoltbotMarketplace
                        onRequestWizard={(type) => {
                            if (type === 'listing') setViewMode('listing-wizard');
                            if (type === 'onboarding') setViewMode('onboarding');
                        }}
                    />
                )}
            </div>

            {successType && (
                <SuccessScreen
                    type={successType}
                    onClose={() => setSuccessType(null)}
                />
            )}
        </>
    );
};

export default App;
