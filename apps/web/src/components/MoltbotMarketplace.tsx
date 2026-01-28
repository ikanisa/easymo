// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Search, Store, Package, ShoppingBag, Send, X, ChevronRight, MapPin, Star, Phone, CheckCircle, AlertCircle, Menu, Home, User, Bell, Plus, Filter, TrendingUp, Heart, Share2, Clock, DollarSign, Tag } from 'lucide-react';

// Claymorphism Marketplace - Moltbot Powered
// Modern, fluid, soft UI with rich interactions

const MoltbotMarketplace = () => {
  const [currentView, setCurrentView] = useState('home');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedListing, setSelectedListing] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const chatEndRef = useRef(null);

  // Mock data
  const categories = [
    { id: 'all', name: 'All', icon: '🏪', color: '#FF6B6B' },
    { id: 'electronics', name: 'Electronics', icon: '📱', color: '#4ECDC4' },
    { id: 'fashion', name: 'Fashion', icon: '👕', color: '#FFE66D' },
    { id: 'food', name: 'Food', icon: '🍔', color: '#FF8B94' },
    { id: 'services', name: 'Services', icon: '🔧', color: '#A8E6CF' },
    { id: 'home', name: 'Home', icon: '🏠', color: '#C7CEEA' }
  ];

  const verifiedVendors = [
    {
      id: 1,
      name: 'TechHub Rwanda',
      category: 'Electronics',
      rating: 4.8,
      reviews: 245,
      verified: true,
      location: 'Kigali, Rwanda',
      image: '📱',
      color: '#4ECDC4',
      products: 156,
      responseTime: '< 1 hour'
    },
    {
      id: 2,
      name: 'Fresh Harvest',
      category: 'Food',
      rating: 4.9,
      reviews: 389,
      verified: true,
      location: 'Musanze, Rwanda',
      image: '🥬',
      color: '#A8E6CF',
      products: 89,
      responseTime: '< 30 min'
    },
    {
      id: 3,
      name: 'Style Avenue',
      category: 'Fashion',
      rating: 4.7,
      reviews: 567,
      verified: true,
      location: 'Kigali, Rwanda',
      image: '👗',
      color: '#FFE66D',
      products: 234,
      responseTime: '< 2 hours'
    }
  ];

  const listings = [
    {
      id: 1,
      title: 'iPhone 13 Pro Max - Like New',
      price: 850000,
      currency: 'RWF',
      category: 'Electronics',
      location: 'Kigali, Nyarugenge',
      verified: true,
      vendorName: 'TechHub Rwanda',
      image: '📱',
      condition: 'Like New',
      postedTime: '2 hours ago',
      views: 45,
      saves: 12
    },
    {
      id: 2,
      title: 'Professional Photography Services',
      price: 50000,
      currency: 'RWF',
      category: 'Services',
      location: 'Kigali, Gasabo',
      verified: false,
      vendorName: 'Unverified Seller',
      image: '📸',
      condition: 'Service',
      postedTime: '5 hours ago',
      views: 23,
      saves: 7
    },
    {
      id: 3,
      title: 'Organic Fresh Vegetables Box',
      price: 15000,
      currency: 'RWF',
      category: 'Food',
      location: 'Musanze',
      verified: true,
      vendorName: 'Fresh Harvest',
      image: '🥬',
      condition: 'Fresh',
      postedTime: '1 hour ago',
      views: 67,
      saves: 23
    },
    {
      id: 4,
      title: 'Designer Ankara Dress',
      price: 35000,
      currency: 'RWF',
      category: 'Fashion',
      location: 'Kigali, Kicukiro',
      verified: true,
      vendorName: 'Style Avenue',
      image: '👗',
      condition: 'New',
      postedTime: '3 hours ago',
      views: 89,
      saves: 34
    }
  ];

  const requests = [
    {
      id: 1,
      type: 'buy',
      title: 'Looking for MacBook Pro M2',
      budget: '1,200,000 - 1,500,000 RWF',
      location: 'Kigali',
      postedTime: '4 hours ago',
      matches: 7,
      status: 'active'
    },
    {
      id: 2,
      type: 'service',
      title: 'Need Interior Designer',
      budget: 'Negotiable',
      location: 'Kigali, Remera',
      postedTime: '1 day ago',
      matches: 12,
      status: 'active'
    }
  ];

  // Moltbot responses
  const moltbotGreeting = {
    role: 'assistant',
    content: "👋 Hi there! I'm Moltbot, your marketplace assistant. I can help you:\n\n• Buy or sell products\n• Find the best matches\n• Connect with verified vendors\n\nWhat would you like to do today?",
    quickReplies: ['I want to buy something', 'I want to sell something', 'Browse vendors', 'Check my requests']
  };

  useEffect(() => {
    if (chatOpen && messages.length === 0) {
      setMessages([moltbotGreeting]);
    }
  }, [chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate Moltbot response
    setTimeout(() => {
      let botResponse;
      
      if (inputValue.toLowerCase().includes('buy')) {
        botResponse = {
          role: 'assistant',
          content: "Great! Let me help you find what you're looking for. 🛍️\n\nWhat would you like to buy?",
          quickReplies: ['Electronics', 'Fashion', 'Food', 'Services', 'Home & Garden']
        };
      } else if (inputValue.toLowerCase().includes('sell')) {
        botResponse = {
          role: 'assistant',
          content: "Perfect! I'll guide you through listing your item. 📝\n\nWhat category does your item belong to?",
          quickReplies: ['Electronics', 'Fashion', 'Food', 'Services', 'Home & Garden']
        };
      } else {
        botResponse = {
          role: 'assistant',
          content: "I'm here to help! Could you tell me more about what you need?",
          quickReplies: ['Buy something', 'Sell something', 'Browse listings']
        };
      }

      setMessages(prev => [...prev, botResponse]);
    }, 800);
  };

  const handleQuickReply = (reply) => {
    setInputValue(reply);
    handleSendMessage();
  };

  const toggleFavorite = (id) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fav => fav !== id) : [...prev, id]
    );
  };

  // Claymorphism styles
  const clayCard = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    boxShadow: `
      8px 8px 16px rgba(163, 177, 198, 0.6),
      -8px -8px 16px rgba(255, 255, 255, 0.9),
      inset 2px 2px 4px rgba(255, 255, 255, 0.3)
    `,
    border: '1px solid rgba(255, 255, 255, 0.5)'
  };

  const clayCardPressed = {
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    boxShadow: `
      inset 4px 4px 8px rgba(163, 177, 198, 0.4),
      inset -4px -4px 8px rgba(255, 255, 255, 0.7)
    `,
    border: '1px solid rgba(255, 255, 255, 0.3)'
  };

  const clayButton = {
    background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
    borderRadius: '16px',
    boxShadow: `
      6px 6px 12px rgba(163, 177, 198, 0.5),
      -6px -6px 12px rgba(255, 255, 255, 0.9)
    `,
    border: 'none',
    transition: 'all 0.3s ease'
  };

  // Views
  const HomeView = () => (
    <div className="home-view">
      {/* Hero Section */}
      <div style={{
        ...clayCard,
        padding: '32px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.15), rgba(78, 205, 196, 0.15))',
        animation: 'float 6s ease-in-out infinite'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '12px',
          letterSpacing: '-0.5px'
        }}>
          Welcome to Moltbot
        </h1>
        <p style={{
          color: '#64748b',
          fontSize: '16px',
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>
          Your AI-powered community marketplace. Buy, sell, and connect with verified vendors in Rwanda.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setChatOpen(true)}
            style={{
              ...clayButton,
              padding: '14px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#FF6B6B',
              cursor: 'pointer'
            }}
          >
            <MessageCircle size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Chat with Moltbot
          </button>
          <button
            onClick={() => setCurrentView('listings')}
            style={{
              ...clayButton,
              padding: '14px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#4ECDC4',
              cursor: 'pointer'
            }}
          >
            <ShoppingBag size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Browse Listings
          </button>
        </div>
      </div>

      {/* Categories */}
      <h2 style={{
        fontSize: '20px',
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '16px',
        letterSpacing: '-0.3px'
      }}>
        Categories
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '12px',
        marginBottom: '32px'
      }}>
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setCurrentView('listings');
            }}
            style={{
              ...clayCard,
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `
                10px 10px 20px rgba(163, 177, 198, 0.6),
                -10px -10px 20px rgba(255, 255, 255, 0.9),
                inset 2px 2px 4px rgba(255, 255, 255, 0.3)
              `;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = clayCard.boxShadow;
            }}
          >
            <div style={{
              fontSize: '32px',
              marginBottom: '8px'
            }}>
              {cat.icon}
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#475569'
            }}>
              {cat.name}
            </div>
          </div>
        ))}
      </div>

      {/* Featured Vendors */}
      <h2 style={{
        fontSize: '20px',
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '16px',
        letterSpacing: '-0.3px'
      }}>
        Verified Vendors
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        {verifiedVendors.map((vendor, idx) => (
          <div
            key={vendor.id}
            style={{
              ...clayCard,
              padding: '20px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              animation: `slideUp 0.5s ease-out ${idx * 0.15}s both`
            }}
            onClick={() => {
              setSelectedListing(vendor);
              setCurrentView('vendor-detail');
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${vendor.color}22, ${vendor.color}44)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                flexShrink: 0
              }}>
                {vendor.image}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{
                    fontSize: '17px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    {vendor.name}
                  </h3>
                  {vendor.verified && (
                    <CheckCircle size={16} style={{ color: '#4ECDC4', flexShrink: 0 }} />
                  )}
                </div>
                <p style={{
                  fontSize: '13px',
                  color: '#64748b',
                  margin: '0 0 8px 0'
                }}>
                  {vendor.category}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={14} style={{ color: '#FFD93D', fill: '#FFD93D' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                      {vendor.rating}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      ({vendor.reviews})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} style={{ color: '#94a3b8' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {vendor.location}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} style={{ color: '#94a3b8' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {vendor.responseTime}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Listings Preview */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0,
          letterSpacing: '-0.3px'
        }}>
          Recent Listings
        </h2>
        <button
          onClick={() => setCurrentView('listings')}
          style={{
            ...clayButton,
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#4ECDC4',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          View All
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
        {listings.slice(0, 4).map((listing, idx) => (
          <ListingCard key={listing.id} listing={listing} idx={idx} />
        ))}
      </div>
    </div>
  );

  const ListingCard = ({ listing, idx }) => (
    <div
      onClick={() => {
        setSelectedListing(listing);
        setCurrentView('listing-detail');
      }}
      style={{
        ...clayCard,
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`,
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(listing.id);
        }}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 10
        }}
      >
        <Heart
          size={16}
          style={{
            color: favorites.includes(listing.id) ? '#FF6B6B' : '#94a3b8',
            fill: favorites.includes(listing.id) ? '#FF6B6B' : 'none'
          }}
        />
      </button>
      
      <div style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(255, 107, 107, 0.1))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '48px',
        marginBottom: '12px'
      }}>
        {listing.image}
      </div>
      
      <h4 style={{
        fontSize: '14px',
        fontWeight: '700',
        color: '#1e293b',
        margin: '0 0 6px 0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {listing.title}
      </h4>
      
      <p style={{
        fontSize: '16px',
        fontWeight: '800',
        color: '#FF6B6B',
        margin: '0 0 8px 0'
      }}>
        {listing.price.toLocaleString()} {listing.currency}
      </p>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
        <MapPin size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
        <span style={{
          fontSize: '11px',
          color: '#64748b',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {listing.location}
        </span>
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '8px',
        borderTop: '1px solid rgba(148, 163, 184, 0.2)'
      }}>
        {listing.verified ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} style={{ color: '#4ECDC4' }} />
            <span style={{ fontSize: '10px', color: '#4ECDC4', fontWeight: '600' }}>
              Verified
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} style={{ color: '#FFE66D' }} />
            <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: '600' }}>
              Unverified
            </span>
          </div>
        )}
        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
          {listing.postedTime}
        </span>
      </div>
    </div>
  );

  const ListingsView = () => (
    <div className="listings-view">
      <div style={{
        ...clayCard,
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <Search size={20} style={{ color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Search listings..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: '15px',
            color: '#1e293b',
            outline: 'none'
          }}
        />
        <button style={{
          ...clayButton,
          padding: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Filter size={18} style={{ color: '#4ECDC4' }} />
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        marginBottom: '24px',
        paddingBottom: '8px'
      }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              ...(selectedCategory === cat.id ? clayCardPressed : clayButton),
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: '600',
              color: selectedCategory === cat.id ? cat.color : '#64748b',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{ marginRight: '6px' }}>{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '16px'
      }}>
        {listings.map((listing, idx) => (
          <ListingCard key={listing.id} listing={listing} idx={idx} />
        ))}
      </div>
    </div>
  );

  const VendorsView = () => (
    <div className="vendors-view">
      <h2 style={{
        fontSize: '24px',
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: '20px',
        letterSpacing: '-0.5px'
      }}>
        Verified Vendors
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {verifiedVendors.map((vendor, idx) => (
          <div
            key={vendor.id}
            onClick={() => {
              setSelectedListing(vendor);
              setCurrentView('vendor-detail');
            }}
            style={{
              ...clayCard,
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              animation: `slideUp 0.5s ease-out ${idx * 0.15}s both`
            }}
          >
            <div style={{ display: 'flex', gap: '20px', alignItems: 'start', marginBottom: '16px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: `linear-gradient(135deg, ${vendor.color}22, ${vendor.color}44)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                flexShrink: 0
              }}>
                {vendor.image}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    {vendor.name}
                  </h3>
                  {vendor.verified && (
                    <CheckCircle size={20} style={{ color: '#4ECDC4', flexShrink: 0 }} />
                  )}
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: '0 0 12px 0'
                }}>
                  {vendor.category}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{
                    ...clayButton,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px'
                  }}>
                    <Star size={14} style={{ color: '#FFD93D', fill: '#FFD93D' }} />
                    <span style={{ fontWeight: '700', color: '#1e293b' }}>
                      {vendor.rating}
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                      ({vendor.reviews})
                    </span>
                  </div>
                  <div style={{
                    ...clayButton,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#64748b'
                  }}>
                    <Package size={14} />
                    {vendor.products} Products
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Location
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <MapPin size={12} />
                  {vendor.location}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Response Time
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Clock size={12} />
                  {vendor.responseTime}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const RequestsView = () => (
    <div className="requests-view">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '800',
          color: '#1e293b',
          marginBottom: '12px',
          letterSpacing: '-0.5px'
        }}>
          Active Requests
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          See what people are looking for. Post your own request or respond to existing ones.
        </p>
      </div>

      <button
        onClick={() => setChatOpen(true)}
        style={{
          ...clayCard,
          width: '100%',
          padding: '20px',
          marginBottom: '24px',
          cursor: 'pointer',
          border: 'none',
          background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(255, 107, 107, 0.1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontSize: '15px',
          fontWeight: '700',
          color: '#4ECDC4',
          transition: 'all 0.3s ease'
        }}
      >
        <Plus size={20} />
        Post New Request
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {requests.map((request, idx) => (
          <div
            key={request.id}
            style={{
              ...clayCard,
              padding: '20px',
              animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`
            }}
          >
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              background: request.type === 'buy' ? 'rgba(78, 205, 196, 0.15)' : 'rgba(255, 230, 109, 0.15)',
              fontSize: '11px',
              fontWeight: '700',
              color: request.type === 'buy' ? '#4ECDC4' : '#F59E0B',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {request.type === 'buy' ? '🛍️ Buying' : '🔧 Service Needed'}
            </div>
            
            <h3 style={{
              fontSize: '17px',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 8px 0'
            }}>
              {request.title}
            </h3>
            
            <div style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={14} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {request.budget}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {request.location}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {request.postedTime}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'rgba(78, 205, 196, 0.1)'
              }}>
                <TrendingUp size={14} style={{ color: '#4ECDC4' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#4ECDC4' }}>
                  {request.matches} Matches
                </span>
              </div>
              
              <button
                style={{
                  ...clayButton,
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#FF6B6B',
                  cursor: 'pointer'
                }}
              >
                Respond
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ListingDetailView = () => {
    if (!selectedListing) return null;
    
    return (
      <div className="listing-detail-view">
        <div style={{
          ...clayCard,
          padding: '24px',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(255, 107, 107, 0.15))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '120px',
            marginBottom: '24px'
          }}>
            {selectedListing.image}
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            {selectedListing.verified ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '12px',
                background: 'rgba(78, 205, 196, 0.15)',
                marginBottom: '12px'
              }}>
                <CheckCircle size={14} style={{ color: '#4ECDC4' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#4ECDC4' }}>
                  Verified Vendor
                </span>
              </div>
            ) : (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '12px',
                background: 'rgba(255, 230, 109, 0.15)',
                marginBottom: '12px'
              }}>
                <AlertCircle size={14} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B' }}>
                  Unverified Seller
                </span>
              </div>
            )}
            
            <h1 style={{
              fontSize: '26px',
              fontWeight: '800',
              color: '#1e293b',
              margin: '0 0 8px 0',
              letterSpacing: '-0.5px',
              lineHeight: '1.3'
            }}>
              {selectedListing.title}
            </h1>
            
            <p style={{
              fontSize: '32px',
              fontWeight: '900',
              color: '#FF6B6B',
              margin: '0 0 16px 0'
            }}>
              {selectedListing.price?.toLocaleString() || 'N/A'} {selectedListing.currency || ''}
            </p>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            padding: '16px',
            borderRadius: '16px',
            background: 'rgba(148, 163, 184, 0.05)',
            marginBottom: '20px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                Condition
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                {selectedListing.condition}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                Category
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                {selectedListing.category}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                Location
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <MapPin size={12} />
                {selectedListing.location}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                Posted
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                {selectedListing.postedTime}
              </div>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <button
              onClick={() => {
                setInputValue(`I'm interested in: ${selectedListing.title}`);
                setChatOpen(true);
              }}
              style={{
                ...clayButton,
                flex: 1,
                padding: '16px',
                fontSize: '15px',
                fontWeight: '700',
                color: '#fff',
                background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MessageCircle size={18} />
              Contact Seller
            </button>
            <button
              onClick={() => toggleFavorite(selectedListing.id)}
              style={{
                ...clayButton,
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Heart
                size={20}
                style={{
                  color: favorites.includes(selectedListing.id) ? '#FF6B6B' : '#94a3b8',
                  fill: favorites.includes(selectedListing.id) ? '#FF6B6B' : 'none'
                }}
              />
            </button>
            <button
              style={{
                ...clayButton,
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Share2 size={20} style={{ color: '#4ECDC4' }} />
            </button>
          </div>
        </div>
        
        <div style={{
          ...clayCard,
          padding: '20px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e293b',
            margin: '0 0 12px 0'
          }}>
            Seller Information
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            borderRadius: '16px',
            background: 'rgba(148, 163, 184, 0.05)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.4))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {selectedListing.image}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                  {selectedListing.vendorName}
                </span>
                {selectedListing.verified && (
                  <CheckCircle size={14} style={{ color: '#4ECDC4' }} />
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Usually responds in 1-2 hours
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const VendorDetailView = () => {
    if (!selectedListing) return null;
    
    return (
      <div className="vendor-detail-view">
        <div style={{
          ...clayCard,
          padding: '24px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '24px',
              background: `linear-gradient(135deg, ${selectedListing.color}22, ${selectedListing.color}44)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              flexShrink: 0
            }}>
              {selectedListing.image}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: '900',
                  color: '#1e293b',
                  margin: 0,
                  letterSpacing: '-0.5px'
                }}>
                  {selectedListing.name}
                </h1>
                <CheckCircle size={24} style={{ color: '#4ECDC4', flexShrink: 0 }} />
              </div>
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                margin: '0 0 12px 0'
              }}>
                {selectedListing.category}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={16} style={{ color: '#FFD93D', fill: '#FFD93D' }} />
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>
                  {selectedListing.rating}
                </span>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                  ({selectedListing.reviews} reviews)
                </span>
              </div>
            </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              ...clayCard,
              padding: '16px',
              textAlign: 'center'
            }}>
              <Package size={24} style={{ color: '#4ECDC4', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                {selectedListing.products}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Products
              </div>
            </div>
            <div style={{
              ...clayCard,
              padding: '16px',
              textAlign: 'center'
            }}>
              <Clock size={24} style={{ color: '#FFE66D', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                {selectedListing.responseTime}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Response
              </div>
            </div>
            <div style={{
              ...clayCard,
              padding: '16px',
              textAlign: 'center'
            }}>
              <MapPin size={24} style={{ color: '#FF6B6B', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                {selectedListing.location.split(',')[0]}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Location
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                setInputValue(`I'd like to know more about ${selectedListing.name}`);
                setChatOpen(true);
              }}
              style={{
                ...clayButton,
                flex: 1,
                padding: '16px',
                fontSize: '15px',
                fontWeight: '700',
                color: '#fff',
                background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MessageCircle size={18} />
              Contact Vendor
            </button>
            <button
              style={{
                ...clayButton,
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Phone size={20} style={{ color: '#4ECDC4' }} />
            </button>
          </div>
        </div>
        
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1e293b',
          margin: '0 0 16px 0'
        }}>
          Products from {selectedListing.name}
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '16px'
        }}>
          {listings.filter(l => l.vendorName === selectedListing.name).map((listing, idx) => (
            <ListingCard key={listing.id} listing={listing} idx={idx} />
          ))}
        </div>
      </div>
    );
  };

  // Chat Interface
  const ChatInterface = () => (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: chatOpen ? '80vh' : '0',
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(20px)',
      borderTopLeftRadius: '32px',
      borderTopRightRadius: '32px',
      boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.1)',
      transition: 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Chat Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            🤖
          </div>
          <div>
            <h3 style={{
              fontSize: '17px',
              fontWeight: '800',
              color: '#1e293b',
              margin: 0
            }}>
              Moltbot Assistant
            </h3>
            <p style={{
              fontSize: '12px',
              color: '#4ECDC4',
              margin: 0
            }}>
              ● Online
            </p>
          </div>
        </div>
        <button
          onClick={() => setChatOpen(false)}
          style={{
            ...clayButton,
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={20} style={{ color: '#64748b' }} />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: `slideUp 0.3s ease-out`
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '14px 18px',
              borderRadius: '20px',
              ...(msg.role === 'user' ? {
                background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
                color: '#fff',
                boxShadow: '6px 6px 12px rgba(78, 205, 196, 0.3)'
              } : {
                ...clayCard,
                color: '#1e293b'
              }),
              fontSize: '15px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>
            
            {msg.quickReplies && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '12px',
                maxWidth: '80%'
              }}>
                {msg.quickReplies.map((reply, rIdx) => (
                  <button
                    key={rIdx}
                    onClick={() => handleQuickReply(reply)}
                    style={{
                      ...clayButton,
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#4ECDC4',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(148, 163, 184, 0.2)',
        background: 'rgba(255, 255, 255, 0.9)'
      }}>
        <div style={{
          ...clayCard,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '15px',
              color: '#1e293b',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              background: inputValue.trim() 
                ? 'linear-gradient(135deg, #4ECDC4, #44A08D)'
                : 'rgba(148, 163, 184, 0.2)',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
          >
            <Send size={18} style={{ color: inputValue.trim() ? '#fff' : '#94a3b8' }} />
          </button>
        </div>
      </div>
    </div>
  );

  // Bottom Navigation
  const BottomNav = () => (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px 20px 20px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(148, 163, 184, 0.2)',
      zIndex: 100
    }}>
      <div style={{
        ...clayCard,
        padding: '12px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'
      }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'listings', icon: Package, label: 'Listings' },
          { id: 'vendors', icon: Store, label: 'Vendors' },
          { id: 'requests', icon: ShoppingBag, label: 'Requests' }
        ].map(nav => (
          <button
            key={nav.id}
            onClick={() => setCurrentView(nav.id)}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.3s ease',
              borderRadius: '12px'
            }}
          >
            <nav.icon
              size={22}
              style={{
                color: currentView === nav.id ? '#4ECDC4' : '#94a3b8',
                transition: 'all 0.3s ease'
              }}
            />
            <span style={{
              fontSize: '11px',
              fontWeight: currentView === nav.id ? '700' : '600',
              color: currentView === nav.id ? '#4ECDC4' : '#94a3b8',
              transition: 'all 0.3s ease'
            }}>
              {nav.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // Top Bar
  const TopBar = () => (
    <div style={{
      position: 'sticky',
      top: 0,
      padding: '16px 20px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
      zIndex: 90,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {(currentView !== 'home' && selectedListing) && (
          <button
            onClick={() => {
              setSelectedListing(null);
              setCurrentView(currentView.includes('vendor') ? 'vendors' : 'listings');
            }}
            style={{
              ...clayButton,
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronRight size={20} style={{ color: '#64748b', transform: 'rotate(180deg)' }} />
          </button>
        )}
        <h2 style={{
          fontSize: '20px',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0
        }}>
          Moltbot
        </h2>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          style={{
            ...clayButton,
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <Bell size={20} style={{ color: '#64748b' }} />
          {notifications.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#FF6B6B'
            }} />
          )}
        </button>
        <button
          style={{
            ...clayButton,
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <User size={20} style={{ color: '#64748b' }} />
        </button>
      </div>
    </div>
  );

  // Main Render
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingBottom: '100px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.1);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(78, 205, 196, 0.3);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(78, 205, 196, 0.5);
        }
      `}</style>

      <TopBar />
      
      <div style={{
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {currentView === 'home' && <HomeView />}
        {currentView === 'listings' && !selectedListing && <ListingsView />}
        {currentView === 'vendors' && !selectedListing && <VendorsView />}
        {currentView === 'requests' && <RequestsView />}
        {currentView === 'listing-detail' && <ListingDetailView />}
        {currentView === 'vendor-detail' && <VendorDetailView />}
      </div>

      <BottomNav />
      <ChatInterface />

      {/* Floating Chat Button (when chat is closed) */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
            border: 'none',
            boxShadow: '0 8px 24px rgba(78, 205, 196, 0.4), 0 0 0 0 rgba(78, 205, 196, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            animation: 'float 3s ease-in-out infinite',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(78, 205, 196, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(78, 205, 196, 0.4)';
          }}
        >
          <MessageCircle size={28} style={{ color: '#fff' }} />
        </button>
      )}
    </div>
  );
};

export default MoltbotMarketplace;
