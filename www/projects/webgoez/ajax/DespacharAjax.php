<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (!isset($_SESSION['csrfDespacho'])) $_SESSION['csrfDespacho']=bin2hex(random_bytes(32));
$session=$_SESSION;
$csrf=$_SESSION['csrfDespacho'];
session_write_close();
try {
   $method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
   if (!in_array($method,['GET','POST'],true)) throw new RuntimeException('Método no permitido.',405);
   $input=$method==='GET' ? $_GET : $_POST;
   if ($method==='POST' && stripos($_SERVER['CONTENT_TYPE'] ?? '','application/json')===0) {
      $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
   }
   if (!is_array($input)) throw new RuntimeException('Datos no válidos.',422);
   $action=$input['action'] ?? ($_GET['action'] ?? ($_GET['op'] ?? 'list'));
   if ($action==='SaveOrUpdate') $action='save';
   if ($method==='POST' && (!is_string($input['csrfToken'] ?? null) || !hash_equals($csrf,$input['csrfToken']))) {
      throw new RuntimeException('Solicitud no válida; recargue Despachar.',403);
   }
   require_once __DIR__ . '/../model/Despachar.php';
   $model=new Despachar(null,$session);
   $data=$input['data'] ?? $input;
   if (is_string($data)) $data=json_decode($data,true,32,JSON_THROW_ON_ERROR);
   if (!is_array($data)) throw new RuntimeException('Datos no válidos.',422);
   foreach (['employeeIds','distribution','challenges'] as $field) {
      if (isset($data[$field]) && is_string($data[$field])) $data[$field]=json_decode($data[$field],true,32,JSON_THROW_ON_ERROR);
   }
   if ($method==='GET') {
      if ($action==='list') $response=$model->listar();
      elseif (in_array($action,['own','myChallenges'],true)) {
         if (array_diff(array_keys($data),['action'])) throw new RuntimeException('La lectura propia no acepta empleado ni sucursal.',422);
         $response=$model->propios();
      }
      elseif ($action==='context') $response=$model->contexto(DespachoCore::positiveId($data['branchId'] ?? null));
      elseif ($action==='forecast') $response=$model->estimar($data);
      else throw new RuntimeException('Acción de lectura no válida.',422);
   } else {
      if ($action==='save') {
         if (isset($data['refSucursal'])) {
            $data['branchId']=$data['refSucursal'];
            $data['expectedRouteId']=$data['refDetalleRuta'] ?? null;
            $data['employeeIds']=$data['empls'] ?? null;
            unset($data['refSucursal'],$data['refDetalleRuta'],$data['empls']);
         }
         unset($data['action'],$data['csrfToken']);
         $response=$model->guardar($data);
      } elseif ($action==='challenge') {
         unset($data['action'],$data['csrfToken']);
         $response=$model->reto($data);
      }
      else throw new RuntimeException('Acción de escritura no válida.',422);
   }
   $response['csrfToken']=$csrf;
   echo json_encode($response,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
   $status=in_array($e->getCode(),[401,403,404,405,409,422,503],true) ? $e->getCode() : 500;
   if ($e instanceof JsonException) $status=422;
   http_response_code($status);
   if ($status===500) error_log('Despacho: ' . $e->getMessage());
   echo json_encode(['error'=>$status===500 ? 'No se pudo gestionar el despacho; revise migración 017 y el registro del servidor.' : $e->getMessage()],
      JSON_UNESCAPED_UNICODE);
}
