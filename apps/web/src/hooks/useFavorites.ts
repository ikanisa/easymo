import { useState, useEffect } from 'react';

export const useFavorites = () => {
    const [favorites, setFavorites] = useState<string[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('moltbot_favorites');
        if (stored) {
            setFavorites(JSON.parse(stored));
        }
    }, []);

    // Save to localStorage whenever favorites change
    useEffect(() => {
        localStorage.setItem('moltbot_favorites', JSON.stringify(favorites));
    }, [favorites]);

    const toggleFavorite = (id: string) => {
        setFavorites(prev => {
            if (prev.includes(id)) {
                return prev.filter(fav => fav !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const isFavorite = (id: string) => favorites.includes(id);

    const clearFavorites = () => setFavorites([]);

    return {
        favorites,
        toggleFavorite,
        isFavorite,
        clearFavorites
    };
};
