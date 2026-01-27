
import React from 'react';

const SettingsPage: React.FC = () => {
    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Settings</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4">Application Settings</h3>
                <p className="text-gray-600">
                    This is a placeholder for the settings page. Future settings like theme customization, notification preferences, and data management options will be available here.
                </p>
            </div>
        </div>
    );
};

export default SettingsPage;
