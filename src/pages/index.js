export async function getServerSideProps(context) {
  return {
    redirect: {
      destination: "/Hlogin",
      permanent: false,
    },
  };
}

export default function Index() {
  return null;
}
