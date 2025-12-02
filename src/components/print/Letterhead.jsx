export default function Letterhead() {
  // Header image path - place bill-header.png in src/assets folder
  const headerImagePath = '/bill-header.png';

  return (
    <div className="letterhead">
      <div className="letterhead-image">
        <img 
          src={headerImagePath} 
          alt="Avia Wellness Header" 
          className="header-image"
          onError={(e) => {
            // Hide image if not found
            e.target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
}
