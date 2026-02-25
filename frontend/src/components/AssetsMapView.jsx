import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function formatLocation(asset) {
  return [asset.country, asset.state_province, asset.town].filter(Boolean).join(', ');
}

function hasCoordinates(asset) {
  return Number.isFinite(asset?.latitude) && Number.isFinite(asset?.longitude);
}

function AssetsMapView({ assets }) {
  const mappedAssets = (assets || []).filter(hasCoordinates);
  const unmapped = (assets || []).filter((a) => !hasCoordinates(a));

  if (!mappedAssets.length) {
    return (
      <section className="stack-md">
        <article className="card">
          <h3>Assets Map</h3>
          <p className="muted">
            No coordinate data available yet. Re-run the ingestion pipeline — the LLM now fills in
            coordinates from its knowledge of mine locations.
          </p>
          {unmapped.length ? (
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              {unmapped.length} asset{unmapped.length === 1 ? '' : 's'} without coordinates:{' '}
              {unmapped.map((a) => a.name).join(', ')}.
            </p>
          ) : null}
        </article>
      </section>
    );
  }

  const lats = mappedAssets.map((a) => a.latitude);
  const lngs = mappedAssets.map((a) => a.longitude);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const bounds = mappedAssets.map((a) => [a.latitude, a.longitude]);

  return (
    <section className="stack-md">
      <article className="card">
        <h3>Assets Map</h3>
        <p className="muted">
          Showing {mappedAssets.length} of {(assets || []).length} asset
          {(assets || []).length === 1 ? '' : 's'} with coordinates from the LLM extraction.
        </p>

        <div className="assets-map-wrap">
          <MapContainer
            key={`${centerLat}-${centerLng}-${mappedAssets.length}`}
            center={[centerLat, centerLng]}
            bounds={bounds}
            boundsOptions={{ padding: [40, 40] }}
            className="assets-map"
            scrollWheelZoom
            whenReady={(event) => setTimeout(() => event.target.invalidateSize(), 100)}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c']}
            />
            {mappedAssets.map((asset) => (
              <Marker key={asset.id} position={[asset.latitude, asset.longitude]}>
                <Popup>
                  <strong>{asset.name}</strong>
                  <br />
                  Status: {asset.status || 'unknown'}
                  <br />
                  Commodity: {asset.commodities?.join(', ') || 'N/A'}
                  <br />
                  Location: {formatLocation(asset) || 'N/A'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </article>

      {unmapped.length ? (
        <article className="card">
          <h4>Assets without coordinates</h4>
          <p className="muted">
            {unmapped.map((a) => a.name).join(', ')}
          </p>
        </article>
      ) : null}
    </section>
  );
}

export default AssetsMapView;
