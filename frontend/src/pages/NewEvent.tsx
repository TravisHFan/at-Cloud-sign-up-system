import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function NewEvent() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    eventType: 'Effective Communication Workshop Series',
    date: '',
    time: '',
    organizer: '',
    purpose: '',
    location: '',
    format: 'Hybrid Participation',
    disclaimer: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Event created:', formData);
    alert('Event created successfully!');
    setShowForm(false);
    setFormData({
      eventType: 'Effective Communication Workshop Series',
      date: '',
      time: '',
      organizer: '',
      purpose: '',
      location: '',
      format: 'Hybrid Participation',
      disclaimer: ''
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!showForm) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Create New Event</h1>
          <p className="text-gray-600 mb-6">
            Create a new event for your organization.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <button
            onClick={() => setShowForm(true)}
            className="group relative inline-flex items-center justify-center w-32 h-32 bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-lg transition-all duration-200"
            title="New Event"
          >
            <PlusIcon className="w-12 h-12 text-blue-600 group-hover:text-blue-700" />
            <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-sm text-gray-600 group-hover:text-gray-700">
              New Event
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Create New Event</h1>
        <button
          onClick={() => setShowForm(false)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to New Event
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <select
              name="eventType"
              value={formData.eventType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Effective Communication Workshop Series">
                Effective Communication Workshop Series
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organizer
            </label>
            <input
              type="text"
              name="organizer"
              value={formData.organizer}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purpose
            </label>
            <textarea
              name="purpose"
              value={formData.purpose}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <select
              name="format"
              value={formData.format}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Hybrid Participation">Hybrid Participation</option>
              <option value="On-site Only">On-site Only</option>
              <option value="Online Only">Online Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disclaimer Terms
            </label>
            <textarea
              name="disclaimer"
              value={formData.disclaimer}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter any disclaimer or terms for this event..."
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create Event
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}