import { MenuItem } from '@blueprintjs/core';
import { ItemRenderer, ItemPredicate } from '@blueprintjs/select';
import React from 'react';

export const WINDOWS_FONTS = [
  'Abadi MT Condensed',
  'Agency FB',
  'Aharoni',
  'Aldhabi',
  'Algerian',
  'Almanac MT',
  'American Uncial',
  'Andale Mono',
  'Andalus',
  'Andy',
  'AngsanaUPC',
  'Angsana New',
  'Aparajita',
  'Arabic Transparent',
  'Arabic Typesetting',
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Arial Rounded MT',
  'Arial Unicode MS',
  'Augsburger Initials',
  'Baskerville Old Face',
  'Batang & BatangChe',
  'Bauhaus 93',
  'Beesknees ITC',
  'Bell MT',
  'Berlin Sans FB',
  'Bernard MT Condensed',
  'Bickley Script',
  'Blackadder ITC',
  'Bodoni MT',
  'Bodoni MT Condensed',
  'Bon Apetit MT',
  'Bookman Old Style',
  'Bookshelf Symbol',
  'Book Antiqua',
  'Bradley Hand ITC',
  'Braggadocio',
  'BriemScript',
  'Broadway',
  'Browallia New',
  'Brush Script MT',
  'Calibri',
  'Californian FB',
  'Calisto MT',
  'Cambria',
  'Candara',
  'Cariadings',
  'Castellar',
  'Centaur',
  'Century',
  'Century Gothic',
  'Century Schoolbook',
  'Chiller',
  'Colonna MT',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Contemporary Brush',
  'Cooper Black',
  'Copperplate Gothic',
  'Corbel',
  'CordiaUPC',
  'Cordia New',
  'Courier New',
  'Ebrima',
  'Eckmann',
  'Edda',
  'Edwardian Script ITC',
  'Elephant',
  'Engravers MT',
  'Enviro',
  'Eras ITC',
  'Estrangelo Edessa',
  'EucrosiaUPC',
  'Euphemia',
  'Eurostile',
  'FangSong',
  'Felix Titling',
  'Fine Hand',
  'Fixed Miriam Transparent',
  'Flexure',
  'Footlight MT',
  'Forte',
  'Franklin Gothic',
  'Franklin Gothic Medium',
  'FrankRuehl',
  'FreesiaUPC',
  'Freestyle Script',
  'French Script MT',
  'Futura',
  'Gabriola',
  'Gadugi',
  'Garamond',
  'Garamond MT',
  'Gautami',
  'Georgia',
  'Georgia Ref',
  'Gigi',
  'Gill Sans MT',
  'Gill Sans MT Condensed',
  'Gisha',
  'Gloucester',
  'Goudy Old Style',
  'Goudy Stout',
  'Gradl',
  'Gulim & GulimChe',
  'Gungsuh & GungsuhChe',
  'Haettenschweiler',
  'Harlow Solid Italic',
  'Harrington',
  'High Tower Text',
  'Holidays MT',
  'Impact',
  'Imprint MT Shadow',
  'Informal Roman',
  'IrisUPC',
  'Iskoola Pota',
  'JasmineUPC',
  'Jokerman',
  'Juice ITC',
  'KaiTi',
  'Kalinga',
  'Kartika',
  'Keystrokes MT',
  'Khmer UI',
  'Kino MT',
  'KodchiangUPC',
  'Kokila',
  'Kristen ITC',
  'Kunstler Script',
  'Lao UI',
  'Latha',
  'LCD',
  'Leelawadee',
  'Levenim MT',
  'LilyUPC',
  'Lucida Blackletter',
  'Lucida Bright',
  'Lucida Bright Math',
  'Lucida Calligraphy',
  'Lucida Console',
  'Lucida Fax',
  'Lucida Handwriting',
  'Lucida Sans',
  'Lucida Sans Typewriter',
  'Lucida Sans Unicode',
  'Magneto',
  'Maiandra GD',
  'Malgun Gothic',
  'Mangal',
  'Matisse ITC',
  'Matura MT Script Capitals',
  'McZee',
  'Mead Bold',
  'Meiryo',
  'Meiryo UI',
  'Mercurius Script MT Bold',
  'Microsoft Sans Serif',
  'Minion Web',
  'Miriam',
  'Miriam Fixed',
  'Mistral',
  'Modern No. 20',
  'Mongolian Baiti',
  'Monotype Corsiva',
  'Monotype Sorts',
  'MoolBoran',
  'MS Gothic',
  'MS LineDraw',
  'MS Mincho',
  'MS Outlook',
  'MS PGothic',
  'MS PMincho',
  'MS Reference',
  'MS UI Gothic',
  'MT Extra',
  'MV Boli',
  'Myanmar Text',
  'Narkisim',
  'News Gothic MT',
  'New Caledonia',
  'Niagara',
  'Nirmala UI',
  'Nyala',
  'Old English Text MT',
  'Onyx',
  'Palace Script MT',
  'Palatino Linotype',
  'Papyrus',
  'Parade',
  'Parchment',
  'Parties MT',
  'Peignot Medium',
  'Pepita MT',
  'Perpetua',
  'Perpetua Titling MT',
  'Placard Condensed',
  'Plantagenet Cherokee',
  'Playbill',
  'Poor Richard',
  'Pristina',
  'Raavi',
  'Rage Italic',
  'Rockwell',
  'Rockwell Condensed',
  'Rockwell Extra Bold',
  'Rod',
  'Runic MT Condensed',
  'Sakkal Majalla',
  'Script MT Bold',
  'Segoe Chess',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI',
  'Segoe UI Symbol',
  'Shonar Bangla',
  'Showcard Gothic',
  'Shruti',
  'Signs MT',
  'Stencil',
  'Stop',
  'Sylfaen',
  'Tahoma',
  'Tempo Grunge',
  'Tempus Sans ITC',
  'Temp Installer Font',
  'Times New Roman',
  'Traditional Arabic',
  'Transport MT',
  'Trebuchet MS',
  'Tunga',
  'Urdu Typesetting',
  'Vacation MT',
  'Vani',
  'Verdana',
  'Verdana Ref',
  'Vijaya',
  'Viner Hand ITC',
  'Vivaldi',
  'Vixar ASCI',
  'Vladimir Script',
  'Vrinda',
  'Webdings',
  'Westminster',
  'Wide Latin',
  'Wingdins',
];

export const MACOS_FONTS = [
  'Al Bayan',
  'American Typewriter',
  'Andalé Mono',
  'Apple Casual',
  'Apple Chancery',
  'Apple Garamond',
  'Apple Gothic',
  'Apple LiGothic',
  'Apple LiSung',
  'Apple Myungjo',
  'Apple Symbols',
  'Arial',
  'Arial Hebrew',
  'Ayuthaya',
  'Baghdad',
  'Baskerville',
  'Beijing',
  'BiauKai',
  'Big Caslon',
  'Brush Script',
  'Chalkboard',
  'Chalkduster',
  'Charcoal',
  'Charcoal CY',
  'Chicago',
  'Cochin',
  'Comic Sans',
  'Cooper',
  'Copperplate',
  'Corsiva Hebrew',
  'Courier',
  'Courier New',
  'DecoType Naskh',
  'Devanagari',
  'Didot',
  'Euphemia UCAS',
  'Futura',
  'Gadget',
  'Geeza Pro',
  'Geezah',
  'Geneva',
  'Geneva CY',
  'Georgia',
  'Gill Sans',
  'Gujarati',
  'Gung Seoche',
  'Gurmukhi',
  'Hangangche',
  'HeadlineA',
  'Hei',
  'Helvetica',
  'Helvetica CY',
  'Helvetica Neue',
  'Herculanum',
  'Hoefler Text',
  'Impact',
  'Inai Mathi',
  'Jung Gothic',
  'Kai',
  'Krungthep',
  'LastResort',
  'LiHei Pro',
  'LiSong Pro',
  'Lucida Grande',
  'Marker Felt',
  'Menlo',
  'Monaco',
  'Monaco CY',
  'Mshtakan',
  'Nadeem',
  'New Peninim',
  'New York',
  'Optima',
  'Osaka',
  'Palatino',
  'Papyrus',
  'Pilgiche',
  'Plantagenet Cherokee',
  'Raanana',
  'San Francisco',
  'Sand',
  'Sathu',
  'Seoul',
  'Shin Myungjo Neue',
  'Silom',
  'Skia',
  'Snell Roundhand',
  'Song',
  'Tahoma',
  'Taipei',
  'Techno',
  'Textile',
  'Thonburi',
  'Times',
  'Times CY',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

export const FONTS =
  process.platform === 'darwin' ? MACOS_FONTS : WINDOWS_FONTS;

export const renderFontItem: ItemRenderer<string> = (
  font,
  { handleClick, modifiers },
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }

  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      key={font}
      onClick={handleClick}
      text={font}
      style={{ fontFamily: getFontForCSS(font) }}
    />
  );
};

/**
 * Given a query and a font, return whether or not the font
 * matches the query.
 *
 * @param {string} query
 * @param {string} font
 * @returns {string}
 */
export const filterFont: ItemPredicate<string> = (query, font) => {
  return font.toLowerCase().includes(query.toLowerCase());
};

/**
 * Returns a font usable for CSS, given its name.
 *
 * @param {string} font
 * @returns {string}
 */
export function getFontForCSS(font: string): string {
  if (font === 'San Francisco') return 'BlinkMacSystemFont';

  return font;
}
