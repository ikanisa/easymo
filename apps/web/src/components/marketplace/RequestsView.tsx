import { Plus, DollarSign, MapPin, Clock, TrendingUp } from 'lucide-react';
import { clayCard, clayButton } from '../../styles/clayStyles';
import { requests } from '../../data/mockMarketplace';

interface RequestsViewProps {
    setChatOpen: (open: boolean) => void;
}

export const RequestsView = ({ setChatOpen }: RequestsViewProps) => {
    return (
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
};
