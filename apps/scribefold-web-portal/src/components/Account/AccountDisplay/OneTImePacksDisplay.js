import { useState } from "react";
import { formatCurrency, formatTokens } from "../../../Global/functions";
import { useSelector } from "react-redux";

export function OneTimePacksDisplay(){
    const [selectedAddonTokens, setSelectedAddonTokens] = useState(2_000_000);
    const authUser = useSelector(state => state.userSlice.authUser);

    const handleGetMoreTokens = async () => {
        try {
        if (!authUser?.id) {
            console.error('Cannot generate token - no user ID');
            return;
        }

        // Call API to generate login token
        const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/generate-login-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authUser.id })
        });

        const data = await response.json();

        if (!data.success || !data.loginToken) {
            console.error('Failed to generate login token:', data.error);
            return;
        }

        // Redirect to editor with token in URL
        const editorUrl = `${window.location.origin}/#/editor?token=${encodeURIComponent(data.loginToken)}`;
        window.location.href = editorUrl;

        } catch (error) {
        console.error('Error in handleGetMoreTokens:', error);
        }
    };

    return (
        <section className="sf-addon-section">
            <div className="sf-addon-header">
                <h2>One-time token packs</h2>
                <p>
                Need an extra burst? Token packs use the same per-token pricing as your
                selected monthly plan. Tokens you buy here never expire, but you need an
                active subscription plan to use them.
                </p>
            </div>
            <div className="sf-addon-slider-row">
                <div className="sf-addon-slider-label">Pick size</div>
                <div className="sf-addon-slider-amount">
                {formatTokens(selectedAddonTokens)} tokens
                </div>
                <div className="sf-addon-slider-price">
                {formatCurrency(0.0075 * selectedAddonTokens)} one-time
                </div>
                <input
                type="range"
                min={500000}
                max={5000000}
                step={500000}
                value={selectedAddonTokens}
                onChange={(e) => setSelectedAddonTokens(Number(e.target.value))}
                />
            </div>
            <div className="sf-addon-grid">
                {[500000, 1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 5000000].map((tokens) => {
                const price = 0.0075 * tokens;
                const isSelected = tokens === selectedAddonTokens;
                return (
                    <button
                    key={tokens}
                    type="button"
                    className={
                        'sf-addon-card' + (isSelected ? ' sf-addon-card-selected' : '')
                    }
                    onClick={() => setSelectedAddonTokens(tokens)}
                    >
                    <div className="sf-addon-tokens">{formatTokens(tokens)} tokens</div>
                    <div className="sf-addon-price">{formatCurrency(price)}</div>
                    </button>
                );
                })}
            </div>
            <div className="sf-addon-footer">
                <button
                type="button"
                className="sf-primary-btn sf-plans-subscribe-btn"
                onClick={handleGetMoreTokens}
                >
                Get {formatTokens(selectedAddonTokens)} more tokens
                </button>
            </div>
        </section>
    )
}