'use client'

import React, { useState, Fragment } from 'react'
import { NotificationRuleType } from '@prisma/client' // Import enum
import { Listbox, Transition } from '@headlessui/react' // Import Listbox
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid' // Import icons

// Define options for the Listbox
const ruleTypeOptions = [
  { id: NotificationRuleType.PRICE_TARGET_ABOVE, name: 'Price Above' },
  { id: NotificationRuleType.PRICE_TARGET_BELOW, name: 'Price Below' },
  { id: NotificationRuleType.PERCENT_CHANGE_INCREASE, name: '% Increase' },
  { id: NotificationRuleType.PERCENT_CHANGE_DECREASE, name: '% Decrease' },
];

interface AddNotificationRuleFormProps {
  trackedAssetId: string; // ID of the parent TrackedAsset
  onRuleAdded: () => void; // Callback to refresh the rule list
}

export default function AddNotificationRuleForm({ trackedAssetId, onRuleAdded }: AddNotificationRuleFormProps) {
  // Use the object structure for selected state with Listbox
  const [selectedRuleType, setSelectedRuleType] = useState(ruleTypeOptions[0]);
  const [value, setValue] = useState('');
  const [timeWindowHours, setTimeWindowHours] = useState('24'); // Default for % change
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPercentChange = selectedRuleType.id === NotificationRuleType.PERCENT_CHANGE_INCREASE || selectedRuleType.id === NotificationRuleType.PERCENT_CHANGE_DECREASE;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const ruleData = {
      trackedAssetId,
      type: selectedRuleType.id, // Use the id from the selected object
      value: parseFloat(value),
      timeWindowHours: isPercentChange ? parseInt(timeWindowHours, 10) : undefined,
      // isEnabled defaults to true on the backend
    };

    // Basic validation
    if (isNaN(ruleData.value)) {
      setError('Invalid value provided.');
      setIsSubmitting(false);
      return;
    }
    if (isPercentChange && (isNaN(ruleData.timeWindowHours!) || ruleData.timeWindowHours! <= 0 || ruleData.timeWindowHours! > 72 )) {
        setError('Invalid time window (must be 1-72 hours).');
        setIsSubmitting(false);
        return;
    }

    // Remove TODO comment
    console.log('Submitting new rule:', ruleData);

    try {
      const response = await fetch('/api/notification-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ruleData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Use error message from API if available
        throw new Error(result.error || `Failed to add rule (status: ${response.status})`);
      }

      console.log('Rule added successfully:', result);
      // Clear form
      setValue('');
      setTimeWindowHours('24');
      setSelectedRuleType(ruleTypeOptions[0]); // Reset select
      // Notify parent to refresh list
      onRuleAdded(); 

    } catch (err) {
      console.error('Failed to add rule:', err);
      // TODO: Add better error feedback (e.g., toast notification)
      setError(err instanceof Error ? err.message : 'Unknown error adding rule.');
    }

    // Remove simulated API call and success/failure logic
    // await new Promise(resolve => setTimeout(resolve, 500)); 
    // const success = Math.random() > 0.2; 
    // if (success) { ... } else { ... }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-dracula-bg rounded-lg border border-dracula-comment">
      <h4 className="text-md font-semibold text-dracula-purple mb-3">Add New Rule</h4>
      {error && <p className="text-dracula-red text-sm mb-3">Error: {error}</p>}
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {/* Rule Type Listbox */}
        <div className="relative">
          <label className="block text-sm font-medium text-dracula-comment mb-1">Type</label>
          <Listbox value={selectedRuleType} onChange={setSelectedRuleType}> 
            <div className="relative mt-1">
              <Listbox.Button className="relative w-full cursor-default rounded bg-dracula-selection py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus-visible:border-dracula-purple focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-dracula-bg text-sm border border-dracula-comment text-dracula-fg">
                <span className="block truncate">{selectedRuleType.name}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-dracula-comment"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-[#44475a] py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm border border-dracula-comment">
                  {ruleTypeOptions.map((option) => (
                    <Listbox.Option
                      key={option.id}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${ 
                          active ? 'bg-dracula-purple text-white' : 'text-dracula-fg bg-[#44475a]' 
                        }`
                      }
                      value={option}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${ 
                              selected ? 'font-medium' : 'font-normal' 
                            }`}
                          >
                            {option.name}
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-dracula-green">
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>

        {/* Value Input */}
        <div>
          <label htmlFor={`value-${trackedAssetId}`} className="block text-sm font-medium text-dracula-comment mb-1">
            {isPercentChange ? 'Percentage (%)' : 'Target Price ($'}
          </label>
          <input
            id={`value-${trackedAssetId}`}
            type="number"
            step="any" 
            placeholder={isPercentChange ? 'e.g., 5 or -10' : 'e.g., 75000'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full p-2 bg-dracula-selection border border-dracula-comment rounded focus:outline-none focus:border-dracula-purple text-dracula-fg text-sm placeholder-dracula-comment"
            required
          />
        </div>

        {/* Time Window Input (Conditional) */}
        {isPercentChange && (
          <div>
            <label htmlFor={`time-window-${trackedAssetId}`} className="block text-sm font-medium text-dracula-comment mb-1">Time Window (h)</label>
            <input
              id={`time-window-${trackedAssetId}`}
              type="number"
              min="1"
              max="72" // As per requirements
              step="1"
              placeholder="1-72 hours"
              value={timeWindowHours}
              onChange={(e) => setTimeWindowHours(e.target.value)}
              className="w-full p-2 bg-dracula-selection border border-dracula-comment rounded focus:outline-none focus:border-dracula-purple text-dracula-fg text-sm placeholder-dracula-comment"
              required={isPercentChange}
            />
          </div>
        )}
      </div>

      <button 
        type="submit"
        className="w-full sm:w-auto bg-dracula-green hover:bg-opacity-80 text-dracula-bg font-semibold py-2 px-4 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Adding Rule...' : 'Add Rule'}
      </button>
    </form>
  )
} 