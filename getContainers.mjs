import Azure from '@azure/storage-blob';

export default async function getContainers(serviceURL) {
    let marker;
    let containers = [];
    do {
        const listContainersResponse = await serviceURL.listContainersSegment(
            Azure.Aborter.none,
            marker
        );

        marker = listContainersResponse.nextMarker;
        containers = [
            ...containers,
            ...listContainersResponse.containerItems
        ]

    } while (marker);
    return containers;
}
