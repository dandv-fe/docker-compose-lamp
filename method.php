
<?php

function limpiar_cadena($cadena)
{
   $cadena = (string)($cadena ?? '');
   $cadena = trim($cadena);
   $cadena = stripslashes($cadena);
   $cadena = str_ireplace("<script>", "", $cadena);
   $cadena = str_ireplace("</script>", "", $cadena);
   $cadena = str_ireplace("<script src", "", $cadena);
   $cadena = str_ireplace("<script type=", "", $cadena);
   $cadena = str_ireplace("SELECT * FROM", "", $cadena);
   $cadena = str_ireplace("DELETE FROM", "", $cadena);
   $cadena = str_ireplace("INSERT INTO", "", $cadena);
   $cadena = str_ireplace("DROP TABLE", "", $cadena);
   $cadena = str_ireplace("DROP DATABASE", "", $cadena);
   $cadena = str_ireplace("TRUNCATE TABLE", "", $cadena);
   $cadena = str_ireplace("SHOW TABLES;", "", $cadena);
   $cadena = str_ireplace("SHOW DATABASES;", "", $cadena);
   $cadena = str_ireplace("<?php", "", $cadena);
   $cadena = str_ireplace("$", "", $cadena);
   $b = '/[[:punct:]]/';
   $cadena = preg_replace($b, "", $cadena);
   $cadena = preg_replace("/\s+/", " ", $cadena);
   $cadena = trim($cadena);
   $cadena = stripslashes($cadena);
   return $cadena;
}

function limpiar_cadena2($cadena)
{
   $cadena = (string)($cadena ?? '');
   $cadena = trim($cadena);
   $cadena = stripslashes($cadena);
   $cadena = str_ireplace("<script>", "", $cadena);
   $cadena = str_ireplace("</script>", "", $cadena);
   $cadena = str_ireplace("<script src", "", $cadena);
   $cadena = str_ireplace("<script type=", "", $cadena);
   $cadena = str_ireplace("SELECT * FROM", "", $cadena);
   $cadena = str_ireplace("DELETE FROM", "", $cadena);
   $cadena = str_ireplace("INSERT INTO", "", $cadena);
   $cadena = str_ireplace("DROP TABLE", "", $cadena);
   $cadena = str_ireplace("DROP DATABASE", "", $cadena);
   $cadena = str_ireplace("TRUNCATE TABLE", "", $cadena);
   $cadena = str_ireplace("SHOW TABLES;", "", $cadena);
   $cadena = str_ireplace("SHOW DATABASES;", "", $cadena);
   $cadena = str_ireplace("<?php", "", $cadena);
   $cadena = str_ireplace("?>", "", $cadena);
   $cadena = str_ireplace("--", "", $cadena);
   $cadena = str_ireplace("^", "", $cadena);
   $cadena = str_ireplace("<", "", $cadena);
   $cadena = str_ireplace("[", "", $cadena);
   $cadena = str_ireplace("]", "", $cadena);
   $cadena = str_ireplace("==", "", $cadena);
   $cadena = str_ireplace(";", "", $cadena);
   $cadena = str_ireplace("::", "", $cadena);
   $cadena = preg_replace("/\s+/", " ", $cadena);
   $cadena = trim($cadena);
   $cadena = stripslashes($cadena);
   return $cadena;
}


# Funcion renombrar fotos #
function renombrar_fotos($nombre)
{
   $b = '/[[:punct:]]/';
   $nombre = preg_replace($b, "", $nombre);
   $nombre = str_ireplace(" ", "", $nombre);
   $nombre = $nombre . "_" . rand(0, 100);
   return $nombre;
}

# Funcion renombrar fotos #
function renombrar_prefijo($nombre)
{
   $b = '/[[:punct:]]/';
   $nombre = preg_replace($b, "", $nombre);
   $nombre = str_ireplace(" ", "", $nombre);
   return $nombre;
}

function uniqidReal($lenght = 13)
{
   // uniqid gives 13 chars, but you could adjust it to your needs.
   if (function_exists("random_bytes")) {
      $bytes = random_bytes(ceil($lenght / 2));
   } elseif (function_exists("openssl_random_pseudo_bytes")) {
      $bytes = openssl_random_pseudo_bytes(ceil($lenght / 2));
   } else {
      throw new Exception("no cryptographically secure random function available");
   }
   return substr(bin2hex($bytes), 0, $lenght);
}

class CustomEncoder
{
   private $encodingMap;
   private $decodingMap;

   public function __construct()
   {
      $this->encodingMap = [
         // Fila de números y símbolos - Usar combinaciones numéricas
         '`' => '01',
         '~' => '02',
         '1' => '03',
         '!' => '04',
         '2' => '05',
         '@' => '06',
         '3' => '07',
         '#' => '08',
         '4' => '09',
         '$' => '10',
         '5' => '11',
         '%' => '12',
         '6' => '13',
         '^' => '14',
         '7' => '15',
         '&' => '16',
         '8' => '17',
         '*' => '18',
         '9' => '19',
         '(' => '20',
         '0' => '21',
         ')' => '22',
         '-' => '23',
         '_' => '24',
         '=' => '25',
         '+' => '26',

         // Primera fila (QWERTY) - Combinaciones letra+número
         'q' => 'A1',
         'Q' => 'B2',
         'w' => 'C3',
         'W' => 'D4',
         'e' => 'E5',
         'E' => 'F6',
         'r' => 'G7',
         'R' => 'H8',
         't' => 'I9',
         'T' => 'J0',
         'y' => 'K1',
         'Y' => 'L2',
         'u' => 'M3',
         'U' => 'N4',
         'i' => 'O5',
         'I' => 'P6',
         'o' => 'Q7',
         'O' => 'R8',
         'p' => 'S9',
         'P' => 'T0',
         '[' => 'U1',
         '{' => 'V2',
         ']' => 'W3',
         '}' => 'X4',
         '\\' => 'Y5',
         '|' => 'Z6',

         // Segunda fila (ASDF) - Combinaciones número+letra
         'a' => '1A',
         'A' => '2B',
         's' => '3C',
         'S' => '4D',
         'd' => '5E',
         'D' => '6F',
         'f' => '7G',
         'F' => '8H',
         'g' => '9I',
         'G' => '0J',
         'h' => '1K',
         'H' => '2L',
         'j' => '3M',
         'J' => '4N',
         'k' => '5O',
         'K' => '6P',
         'l' => '7Q',
         'L' => '8R',
         ';' => '9S',
         ':' => '0T',
         "'" => '1U',
         '"' => '2V',

         // Tercera fila (ZXCV) - Combinaciones mixtas
         'z' => 'A3',
         'Z' => 'B4',
         'x' => 'C5',
         'X' => 'D6',
         'c' => 'E7',
         'C' => 'F8',
         'v' => 'G9',
         'V' => 'H0',
         'b' => 'I1',
         'B' => 'J2',
         'n' => 'K3',
         'N' => 'L4',
         'm' => 'M5',
         'M' => 'N6',
         ',' => 'O7',
         '<' => 'P8',
         '.' => 'Q9',
         '>' => 'R0',
         '/' => 'S1',
         '?' => 'T2',

         // Espacio y caracteres especiales
         ' ' => 'U3',
         '\t' => 'V4', // Tab
         '\n' => 'W5', // Enter/Newline
         '\r' => 'X6'  // Carriage return
      ];

      $this->decodingMap = array_flip($this->encodingMap);
   }

   public function encode($text)
   {
      $encoded = '';
      for ($i = 0; $i < strlen($text); $i++) {
         $char = $text[$i];
         $encoded .= isset($this->encodingMap[$char]) ? $this->encodingMap[$char] : $char;
      }
      return $encoded;
   }

   public function decode($encodedText)
   {
      $decoded = '';
      for ($i = 0; $i < strlen($encodedText); $i += 2) {
         $code = substr($encodedText, $i, 2);
         $decoded .= isset($this->decodingMap[$code]) ? $this->decodingMap[$code] : '?';
      }
      return $decoded;
   }
}

?>