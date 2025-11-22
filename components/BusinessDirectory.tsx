
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Business } from '../types';
import { searchLocalBusinesses } from '../services/gemini';

interface Props {
  onNotify: (msg: string, type: 'success' | 'info' | 'warning') => void;
}

// Comprehensive list of Google Maps Place Types (Table A & Table B)
// Maximized to include specific retail, service, and food categories.
const GOOGLE_MAPS_CATEGORIES = [
  "All", "Accounting", "Advertising Agency", "Agricultural Service", "Airport", "Amusement Center", "Amusement Park", "Animal Shelter", "Antique Store", "Aquarium", "Architectural Bureau", "Art Gallery", "Art Studio", "ATM", "Auto Parts Store", "Auto Repair", "Bakery", "Bank", "Bar", "Barber Shop", "Beauty Salon", "Bed and Breakfast", "Beer Store", "Bicycle Store", "Book Store", "Bowling Alley", "Breakfast Restaurant", "Brewery", "Bridal Shop", "Building Material Store", "Bus Station", "Business Center", "Butcher Shop", "Cafe", "Camera Store", "Campground", "Car Dealer", "Car Inspection Station", "Car Rental", "Car Repair", "Car Wash", "Casino", "Catering Service", "Cell Phone Store", "Cemetery", "Child Care Agency", "Church", "City Hall", "Clothing Store", "Coffee Shop", "Cold Storage Service", "Computer Store", "Construction Company", "Consulting Firm", "Convenience Store", "Convention Center", "Copier and Printer Repair", "Corporate Office", "Courier Service", "Courthouse", "Credit Union", "Cultural Center", "Currency Exchange", "Dairy Store", "Dance School", "Day Care Center", "Deli", "Dental Clinic", "Dentist", "Department Store", "Design Agency", "Dessert Shop", "Discount Store", "Distribution Center", "Doctor", "Drugstore", "Dry Cleaner", "Education Center", "Electrician", "Electronics Store", "Embassy", "Emergency Room", "Employment Agency", "Engineering Consultant", "Entertainment Center", "Event Venue", "Fabric Store", "Farm", "Fashion Accessories Store", "Fast Food Restaurant", "Financial Institution", "Fire Station", "Fitness Center", "Florist", "Food Bank", "Food Court", "Funeral Home", "Furniture Store", "Garden Center", "Gas Station", "General Contractor", "Gift Shop", "Glass Shop", "Golf Course", "Government Office", "Grocery Store", "Guest House", "Gym", "Hair Care", "Hardware Store", "Health Food Store", "Heating Contractor", "Hindu Temple", "Hobby Shop", "Home Goods Store", "Home Improvement Store", "Hospital", "Hostel", "Hotel", "HVAC Contractor", "Ice Cream Shop", "Import Export Company", "Industrial Equipment Supplier", "Insurance Agency", "Internet Cafe", "Investment Company", "Jewelry Store", "Juice Bar", "Karaoke Bar", "Laundry", "Law Firm", "Lawyer", "Library", "Light Rail Station", "Lighting Store", "Liquor Store", "Local Government Office", "Locksmith", "Lodging", "Logistics Service", "Lottery Retailer", "Lounge", "Luggage Store", "Machine Shop", "Mail Delivery Service", "Management School", "Manufacturing Company", "Market", "Marketing Agency", "Massage Therapist", "Meal Delivery", "Meal Takeaway", "Medical Clinic", "Medical Lab", "Medical Supply Store", "Meeting Room", "Money Transfer Service", "Mosque", "Motel", "Motorcycle Dealer", "Motorcycle Repair", "Motorcycle Shop", "Movie Rental", "Movie Theater", "Moving Company", "Museum", "Music School", "Music Store", "Nail Salon", "Night Club", "Non-Profit Organization", "Notary Public", "Office Supply Store", "Oil Change Station", "Optician", "Outlet Store", "Painter", "Painting Service", "Park", "Parking", "Party Store", "Pawn Shop", "Performing Arts Theater", "Pest Control Service", "Pet Boarding", "Pet Grooming", "Pet Store", "Pet Supply Store", "Pharmacy", "Photographer", "Physiotherapist", "Pizza Restaurant", "Plumber", "Police", "Post Office", "Primary School", "Print Shop", "Psychic", "Pub", "Public Transport Station", "Real Estate Agency", "Real Estate Developer", "Recycling Center", "Religious Organization", "Rental Agency", "Research Institute", "Resort", "Restaurant", "Roofing Contractor", "RV Park", "Sandwich Shop", "School", "Seafood Restaurant", "Secondary School", "Security System Supplier", "Self Storage", "Sewing Shop", "Shoe Repair", "Shoe Store", "Shopping Mall", "Sign Shop", "Solar Energy Contractor", "Spa", "Sporting Goods Store", "Sports Club", "Stadium", "Stationery Store", "Steak House", "Storage", "Store", "Subway Station", "Supermarket", "Swimming Pool", "Synagogue", "Tailor", "Tattoo Shop", "Taxi Service", "Taxi Stand", "Tea House", "Telecommunications Service", "Tire Shop", "Tourist Attraction", "Tourist Information Center", "Toy Store", "Train Station", "Training Center", "Transit Station", "Transport Company", "Travel Agency", "Truck Dealer", "Truck Repair", "Truck Stop", "University", "Used Car Dealer", "Variety Store", "Vegan Restaurant", "Vegetarian Restaurant", "Vehicle Inspection", "Veterinary Care", "Video Game Store", "Warehouse", "Waste Management Service", "Watch Store", "Water Park", "Wedding Service", "Wholesale Store", "Wholesaler", "Wine Bar", "Winery", "Zoo"
];

// Advanced Mock Data Generator
const GENERATE_MOCK = (): Business[] => {
    const base: Business[] = [
        { id: 'b1', name: 'Kigali Central Pharmacy', category: 'Pharmacy', city: 'Kigali', address: 'KN 4 Ave, Kigali', phone: '+250788123456', whatsapp: '+250788123456', status: 'NEW', rating: 4.5, lat: -1.9441, lng: 30.0619, lastChecked: '2023-10-26', notes: 'Good candidate for insurance.' },
        { id: 'b2', name: 'Gasabo Hardware Solutions', category: 'Hardware Store', city: 'Kigali', address: 'KG 11 Ave, Kimironko', phone: '+250783555111', whatsapp: '+250783555111', status: 'CONTACTED', rating: 4.2, lat: -1.9500, lng: 30.1100, lastChecked: '2023-10-25', notes: 'Asked to call back next week.' },
        { id: 'b3', name: 'Musanze Electronics Repair', category: 'Electronics Store', city: 'Musanze', address: 'Main Market St, Musanze', phone: '+250789999888', whatsapp: '+250789999888', status: 'QUALIFIED', rating: 4.8, lat: -1.5000, lng: 29.6333, lastChecked: '2023-10-20', website: 'https://musanze-repair.rw' },
        { id: 'b4', name: 'Rapid Moto Transport', category: 'Travel Agency', city: 'Kigali', address: 'Nyamirambo High St', phone: '+250791222333', whatsapp: '+250791222333', status: 'NEW', rating: 3.9, lat: -1.9800, lng: 30.0500, lastChecked: '2023-10-27' },
        { id: 'b5', name: 'Rubavu Lake View Hotel', category: 'Lodging', city: 'Rubavu', address: 'Lake Kivu Shore', phone: '+250785444777', whatsapp: '+250785444777', status: 'DO_NOT_CALL', rating: 4.6, lat: -1.6900, lng: 29.2500, lastChecked: '2023-10-15', notes: 'Blacklisted by user request.' },
        { id: 'b6', name: 'Remera Medical Clinic', category: 'Medical Clinic', city: 'Kigali', address: 'KG 17 Ave', phone: '+250788000111', whatsapp: '+250788000111', status: 'NEW', rating: 4.1, lat: -1.9600, lng: 30.1000, lastChecked: '2023-10-27' },
    ];
    
    const cities = ['Kigali', 'Musanze', 'Rubavu', 'Huye', 'Rwamagana', 'Rusizi', 'Karongi', 'Muhanga'];
    const statuses = ['NEW', 'NEW', 'NEW', 'NEW', 'CONTACTED', 'QUALIFIED', 'DO_NOT_CALL'];
    
    const namePrefixes = ['Alpha', 'Sunrise', 'Kigali', 'Rwanda', 'Great Lakes', 'City', 'Express', 'Elite', 'Royal', 'Golden', 'Silver', 'Diamond', 'Trusted', 'Best', 'Rapid', 'Quick', 'Smart', 'Global', 'Local', 'National', 'Star', 'Vision', 'Future', 'Modern', 'Classic', 'Prime', 'Top', 'Pro'];
    const streetNames = ['KN 4 Ave', 'KG 11 Ave', 'KK 500 St', 'KN 2 St', 'Airport Rd', 'Market St', 'Lake View Rd', 'Main St', 'Hospital Rd', 'University Rd', 'RN 1', 'RN 3'];

    const coreCategories = ['Pharmacy', 'Hardware Store', 'Electronics Store', 'Auto Repair', 'Auto Parts Store', 'Restaurant', 'Cafe', 'Bar', 'Hotel', 'General Contractor'];

    let result: Business[] = [...base];

    for(let i=0; i<8000; i++) {
        const city = Math.random() > 0.4 ? 'Kigali' : cities[Math.floor(Math.random() * cities.length)];
        let cat: string;
        if (Math.random() < 0.7) {
            cat = coreCategories[Math.floor(Math.random() * coreCategories.length)];
        } else {
            cat = GOOGLE_MAPS_CATEGORIES[Math.floor(Math.random() * (GOOGLE_MAPS_CATEGORIES.length - 1)) + 1];
        }

        const stat = statuses[Math.floor(Math.random() * statuses.length)] as any;
        const street = streetNames[Math.floor(Math.random() * streetNames.length)];
        const prefix = namePrefixes[Math.floor(Math.random() * namePrefixes.length)];
        let suffix = '';
        if (cat.includes('Store') || cat.includes('Shop')) suffix = 'Shop';
        else if (cat.includes('Services')) suffix = 'Services';
        else suffix = 'Ltd';

        let name = '';
        const nameStyle = Math.random();
        if (nameStyle < 0.4) {
            name = `${prefix} ${cat.replace('Store', '').replace('Shop', '').trim()} ${suffix}`.trim();
        } else if (nameStyle < 0.7) {
             name = `${city} ${cat.replace('Store', '').trim()}`;
        } else {
             name = `${prefix} ${city} ${cat.replace('Store', '').trim()}`;
        }
        if (Math.random() > 0.8) name += ` ${Math.floor(Math.random() * 100)}`;
        const hasPhone = Math.random() > 0.15; // 85% have a phone number
        const phone = hasPhone ? `+25078${Math.floor(Math.random()*9)}${Math.floor(Math.random()*100000 + 100000)}` : 'N/A';

        result.push({
            id: `sim-${i}`,
            name: name,
            category: cat,
            city: city,
            address: `${street}, ${city}`,
            phone: phone,
            whatsapp: (hasPhone && Math.random() > 0.3) ? phone : undefined, // 70% of those with phones have whatsapp
            status: stat,
            rating: (3 + Math.random() * 2).toFixed(1) as any,
            lat: (city === 'Kigali' ? -1.9 : -2.0) + (Math.random() * 0.1) - 0.05,
            lng: (city === 'Kigali' ? 30.0 : 29.7) + (Math.random() * 0.1) - 0.05,
            lastChecked: new Date().toISOString().split('T')[0]
        });
    }
    return result;
};


const getCategoryIcon = (category: string) => {
    const catLower = category.toLowerCase();
    if (catLower.includes('pharmacy') || catLower.includes('drugstore') || catLower.includes('medic')) return { icon: 'fas fa-pills', color: 'text-red-500' };
    if (catLower.includes('hardware') || catLower.includes('tool')) return { icon: 'fas fa-tools', color: 'text-orange-500' };
    if (catLower.includes('electronic')) return { icon: 'fas fa-plug', color: 'text-blue-500' };
    if (catLower.includes('repair') || catLower.includes('auto')) return { icon: 'fas fa-wrench', color: 'text-gray-600' };
    if (catLower.includes('restaurant') || catLower.includes('cafe') || catLower.includes('food') || catLower.includes('bar')) return { icon: 'fas fa-utensils', color: 'text-amber-600' };
    if (catLower.includes('hotel') || catLower.includes('lodging')) return { icon: 'fas fa-bed', color: 'text-teal-500' };
    if (catLower.includes('transport') || catLower.includes('travel')) return { icon: 'fas fa-car', color: 'text-purple-500' };
    if (catLower.includes('store') || catLower.includes('shop')) return { icon: 'fas fa-shopping-bag', color: 'text-pink-500' };
    if (catLower.includes('bank') || catLower.includes('financ')) return { icon: 'fas fa-university', color: 'text-indigo-600' };
    return { icon: 'fas fa-building', color: 'text-gray-400' };
};

export const BusinessDirectory: React.FC<Props> = ({ onNotify }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [hideNoPhone, setHideNoPhone] = useState(true); // Filter state, enabled by default
  const [visibleCount, setVisibleCount] = useState(20);
  const observer = useRef<IntersectionObserver | null>(null);
  const [showIngestionModal, setShowIngestionModal] = useState(false);
  const [ingestQuery, setIngestQuery] = useState('');
  const [ingestCity, setIngestCity] = useState('Kigali');
  const [isDeepSearchRunning, setIsDeepSearchRunning] = useState(false);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
      setBusinesses(GENERATE_MOCK());
      onNotify('Loaded 8,000+ simulated business records.', 'success');
  }, []);
  
  const availableCities = React.useMemo(() => {
    const citySet = new Set(businesses.map(b => b.city));
    return ['All', ...Array.from(citySet).sort()];
  }, [businesses]);

  const availableCategories = React.useMemo(() => {
    const counts: Record<string, number> = {};
    businesses.forEach(b => {
        counts[b.category] = (counts[b.category] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });
    return sorted;
  }, [businesses]);

  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'All' || b.category === filterCategory;
    const matchesCity = filterCity === 'All' || b.city === filterCity;
    const matchesPhone = !hideNoPhone || (b.phone && b.phone.trim() !== '' && b.phone.trim() !== 'N/A');
    return matchesSearch && matchesCategory && matchesCity && matchesPhone;
  });

  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, filterCategory, filterCity, hideNoPhone]);

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 50, filteredBusinesses.length));
      }
    });
    if (node) observer.current.observe(node);
  }, [filteredBusinesses.length]);

  const displayedBusinesses = filteredBusinesses.slice(0, visibleCount);

  const handleLiveSearch = async () => {
    if (!searchQuery.trim() && filterCategory === 'All') return;
    setLiveSearchLoading(true);
    let finalQuery = searchQuery;
    if (filterCategory !== 'All') {
        finalQuery = `${filterCategory} ${searchQuery}`.trim();
    }
    onNotify(`Querying Maps for "${finalQuery}"...`, 'info');
    try {
      const results = await searchLocalBusinesses(finalQuery, filterCity === 'All' ? 'Rwanda' : filterCity);
      if (results && results.length > 0) {
        const newBusinesses: Business[] = results.map((r: any, idx: number) => ({
          id: `gm-${Date.now()}-${idx}`, name: r.name, category: r.category || filterCategory !== 'All' ? filterCategory : 'Uncategorized', city: r.city || filterCity !== 'All' ? filterCity : 'Kigali', address: r.address, phone: r.phone || 'N/A', whatsapp: r.phone || 'N/A', status: 'NEW', rating: r.rating || 0, lat: r.lat || -1.9441, lng: r.lng || 30.0619, lastChecked: new Date().toISOString().split('T')[0], website: ''
        }));
        setBusinesses(prev => [...newBusinesses, ...prev]);
        onNotify(`Found ${newBusinesses.length} new businesses!`, 'success');
      } else {
        onNotify('No structured results found via Maps Grounding.', 'warning');
      }
    } catch (e) {
      console.error(e);
      onNotify('Search failed. Try simpler keywords.', 'warning');
    } finally {
      setLiveSearchLoading(false);
    }
  };

  const triggerDeepSearch = () => {
    if(!ingestQuery) return;
    setIsDeepSearchRunning(true);
    setShowIngestionModal(false);
    onNotify(`Deep Search Job started: "${ingestQuery}" in ${ingestCity}`, 'info');
    setTimeout(() => {
        setIsDeepSearchRunning(false);
        onNotify('Deep Search Complete. Database updated with new leads.', 'success');
        const newLeads: Business[] = [];
        for(let i=0; i<50; i++) {
             newLeads.push({
                id: `ds-${Date.now()}-${i}`, name: `${ingestQuery} Spot ${i+1}`, category: ingestQuery, city: ingestCity, address: `New Road ${i}, ${ingestCity}`, phone: '+250788000000', whatsapp: '+250788000000', status: 'NEW', rating: 4.0, lat: -1.95, lng: 30.1, lastChecked: new Date().toISOString().split('T')[0]
             });
        }
        setBusinesses(prev => [...newLeads, ...prev]);
    }, 4000);
  };

  const handleUpdateBusiness = (id: string, field: keyof Business, value: any) => {
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    if (selectedBusiness?.id === id) {
        setSelectedBusiness(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleBusinessSelect = (business: Business) => {
    setSelectedBusiness(business);
    setIsDetailModalOpen(true);
  };
  
  const getStatusColor = (status: string) => {
    switch(status) {
        case 'NEW': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'CONTACTED': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'QUALIFIED': return 'bg-green-100 text-green-700 border-green-200';
        case 'DO_NOT_CALL': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-gray-100 text-gray-600';
    }
  };

  const DetailModal = () => {
    if (!selectedBusiness) return null;

    const { icon, color } = getCategoryIcon(selectedBusiness.category);

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsDetailModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="h-48 w-full relative">
                    <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${selectedBusiness.lat},${selectedBusiness.lng}&z=15&output=embed`} title="Location Map" className="rounded-t-2xl"></iframe>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center text-sm text-gray-500 mb-1">
                                <i className={`${icon} ${color} mr-2`}></i> {selectedBusiness.category}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 leading-tight">{selectedBusiness.name}</h2>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusColor(selectedBusiness.status)}`}>
                            {selectedBusiness.status}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                         <a href={`tel:${selectedBusiness.phone}`} className="bg-gray-800 hover:bg-black text-white py-3 rounded-xl font-bold shadow-lg shadow-gray-200 transition-all transform hover:-translate-y-0.5 flex items-center justify-center">
                            <i className="fas fa-phone-alt mr-2"></i> Call Now
                        </a>
                        {selectedBusiness.whatsapp && (
                           <a href={`https://wa.me/${selectedBusiness.whatsapp.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-200 transition-all transform hover:-translate-y-0.5 flex items-center justify-center">
                              <i className="fab fa-whatsapp mr-2"></i> WhatsApp
                           </a>
                        )}
                    </div>

                    <div className="space-y-3">
                         <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Address</label>
                              <div className="text-sm text-gray-700">{selectedBusiness.address}</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Internal Notes</label>
                              <textarea value={selectedBusiness.notes || ''} onChange={(e) => handleUpdateBusiness(selectedBusiness.id, 'notes', e.target.value)} className="bg-transparent border-none focus:outline-none text-gray-700 text-sm w-full h-20 resize-none" placeholder="Add internal notes here..."/>
                          </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                     <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-200 rounded-lg">Close</button>
                </div>
            </div>
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
             `}</style>
        </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden relative">
      {isDetailModalOpen && <DetailModal />}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
             <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <i className="fas fa-store-alt mr-2 text-indigo-600"></i>
                Business Directory
             </h2>
             <p className="text-xs text-gray-500">
                Total Database: <span className="font-mono font-bold text-indigo-600">{businesses.length.toLocaleString()}</span> listings.
             </p>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={() => setShowIngestionModal(true)}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 shadow-sm transition-colors"
             >
                <i className="fas fa-cloud-download-alt md:mr-2"></i> <span className="hidden md:inline">Ingest Data</span>
             </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
           <div className="flex-1 relative">
               <input 
                 type="text" 
                 placeholder="Search name, address, or type..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleLiveSearch()}
                 className="w-full pl-10 pr-24 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-gray-900"
               />
               <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
               <button 
                 onClick={handleLiveSearch}
                 disabled={liveSearchLoading}
                 className="absolute right-1 top-1 bottom-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
               >
                 {liveSearchLoading ? <i className="fas fa-spinner fa-spin"></i> : 'Maps Search'}
               </button>
           </div>
           <div className="flex gap-2 w-full md:w-auto">
             <select 
               value={filterCategory}
               onChange={(e) => setFilterCategory(e.target.value)}
               className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none w-1/2 md:w-48"
             >
               <option value="All">All Categories ({businesses.length})</option>
               {availableCategories.map(([cat, count]) => (
                   <option key={cat} value={cat}>{cat} ({count})</option>
               ))}
             </select>
             <select 
               value={filterCity}
               onChange={(e) => setFilterCity(e.target.value)}
               className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none w-1/2 md:w-36"
             >
                {availableCities.map(c => <option key={c} value={c}>{c === 'All' ? 'All Cities' : c}</option>)}
             </select>
           </div>
        </div>
         <div className="flex items-center text-xs text-gray-600 mt-2">
            <input
                id="hide-no-phone"
                type="checkbox"
                checked={hideNoPhone}
                onChange={(e) => setHideNoPhone(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="hide-no-phone" className="ml-2 font-medium">Hide businesses without phone numbers</label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50">
           {displayedBusinesses.length === 0 ? (
               <div className="p-10 text-center text-gray-400">
                   <i className="fas fa-search text-3xl mb-2 opacity-20"></i>
                   <p>No businesses found.</p>
                   <button onClick={() => {setSearchQuery(''); setFilterCategory('All'); setFilterCity('All');}} className="text-indigo-600 text-sm mt-2 hover:underline">Clear Filters</button>
               </div>
           ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
                   {displayedBusinesses.map((b, index) => {
                       const { icon, color } = getCategoryIcon(b.category);
                       const isLast = index === displayedBusinesses.length - 1;
                       return (
                           <div 
                             key={b.id}
                             ref={isLast ? lastElementRef : null}
                             onClick={() => handleBusinessSelect(b)}
                             className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-300 hover:-translate-y-1 transition-all cursor-pointer flex flex-col"
                           >
                              <div className="p-4 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mr-3 bg-gray-100 ${color}`}>
                                        <i className={icon}></i>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(b.status)}`}>
                                        {b.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-sm text-gray-800 leading-tight mb-1 truncate">{b.name}</h3>
                                <p className="text-xs text-gray-500 truncate"><i className="fas fa-map-marker-alt mr-1 w-3 text-gray-400"></i> {b.address}</p>
                              </div>
                              <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-2">
                                 <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center justify-center w-8 h-8 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-800 hover:text-white transition-colors" title="Call">
                                    <i className="fas fa-phone-alt"></i>
                                 </a>
                                 {b.whatsapp && (
                                    <a href={`https://wa.me/${b.whatsapp.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center justify-center w-8 h-8 bg-gray-200 text-gray-600 rounded-full hover:bg-green-500 hover:text-white transition-colors" title="WhatsApp">
                                        <i className="fab fa-whatsapp"></i>
                                    </a>
                                 )}
                              </div>
                           </div>
                       );
                   })}
               </div>
           )}
           {visibleCount < filteredBusinesses.length && (
               <div className="p-4 text-center text-gray-400 text-xs flex items-center justify-center">
                   <i className="fas fa-circle-notch fa-spin mr-2"></i> Loading more...
               </div>
           )}
      </div>
      {showIngestionModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">Run Deep Search</h3>
                    <p className="text-xs text-gray-500 mt-1">Trigger backend to scrape Google Maps.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Search Query</label>
                        <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" placeholder="e.g., Pharmacies" value={ingestQuery} onChange={(e) => setIngestQuery(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Target City</label>
                        <select className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none text-gray-900" value={ingestCity} onChange={(e) => setIngestCity(e.target.value)}>
                            <option value="Kigali">Kigali</option>
                            <option value="Musanze">Musanze</option>
                        </select>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3">
                    <button onClick={() => setShowIngestionModal(false)} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={triggerDeepSearch} disabled={!ingestQuery} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm disabled:opacity-50">Start Ingestion</button>
                </div>
            </div>
        </div>
      )}
      {isDeepSearchRunning && (
        <div className="absolute inset-0 z-50 bg-white/80 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-indigo-800">Indexing Businesses...</h3>
        </div>
      )}
    </div>
  );
};